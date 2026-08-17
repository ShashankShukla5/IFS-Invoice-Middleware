'use strict';

const { config } = require('../../config');
const { ValidationError } = require('../../utils/errors');
const { mapIFSStatusToPaymentStatus } = require('./paymentStatus.mapper');
const { omitUndefined } = require('../validators/einvoicePayload.validator');

function pick(obj, path) {
  if (!obj || !path) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];
  // allow camelCase / PascalCase / snake_case soft fallbacks
  const lower = path.toLowerCase();
  const key = Object.keys(obj).find((k) => k.toLowerCase() === lower || k.toLowerCase().replace(/_/g, '') === lower.replace(/_/g, ''));
  return key ? obj[key] : undefined;
}

function toDateOnly(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toNumber(value, fieldName) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new ValidationError(`Invalid numeric value for ${fieldName}`, { fieldName, value });
  }
  return n;
}

function joinAddressParts(...parts) {
  return parts
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter(Boolean)
    .join(' ')
    .trim();
}

function buildDocumentIdentifier({ header, company, seriesId, invoiceNo }) {
  const strategy = config.mapping.documentIdentifierStrategy;
  if (strategy === 'INVOICE_ID') {
    const invoiceId = pick(header, config.ifs.fieldMap.header.invoiceId);
    if (!invoiceId) {
      throw new ValidationError('document_identifier strategy INVOICE_ID requires invoiceId');
    }
    return String(invoiceId);
  }
  return `${company}-${seriesId}-${invoiceNo}`;
}

function mapInvoiceTypeCode(ifsInvoiceType) {
  const map = config.mapping.invoiceTypeCodeMap || {};
  if (ifsInvoiceType != null && map[ifsInvoiceType] != null) {
    return String(map[ifsInvoiceType]);
  }
  // Soft normalize common labels if explicitly present in map keys case-insensitively
  if (ifsInvoiceType != null) {
    const entry = Object.entries(map).find(([k]) => k.toLowerCase() === String(ifsInvoiceType).toLowerCase());
    if (entry) return String(entry[1]);
  }
  return null;
}

function mapTaxCategoryId(vatCode) {
  if (vatCode == null || vatCode === '') return null;
  const map = config.mapping.taxCategoryMap || {};
  if (map[vatCode] != null) return String(map[vatCode]);
  const entry = Object.entries(map).find(([k]) => k.toLowerCase() === String(vatCode).toLowerCase());
  if (entry) return String(entry[1]);
  // If no mapping configured, pass through IFS vat_code (business must confirm)
  return String(vatCode);
}

function mapTransactionCategory(ifsInvoice) {
  const fromLine = ifsInvoice.lines?.[0]?.transactionCategory || ifsInvoice.header?.transactionCategory;
  if (fromLine) return String(fromLine);
  if (config.mapping.defaults.transactionCategory) {
    return config.mapping.defaults.transactionCategory;
  }
  return null;
}

/**
 * Map IFS customer invoice aggregate → Nigerian e-invoice payload.
 * Designed so credit/debit can later add cancel_references.
 */
function mapCustomerInvoiceToEinvoice(ifsInvoice) {
  const fm = config.ifs.fieldMap;
  const header = ifsInvoice.header || {};
  const customer = ifsInvoice.customer || {};
  const contact = ifsInvoice.contact || {};
  const address = ifsInvoice.address || {};
  const lines = ifsInvoice.lines || [];

  const company = String(pick(header, fm.header.company) ?? ifsInvoice.company ?? '');
  const seriesId = String(pick(header, fm.header.seriesId) ?? ifsInvoice.seriesId ?? '');
  const invoiceNo = String(pick(header, fm.header.invoiceNo) ?? ifsInvoice.invoiceNo ?? '');

  const missing = [];
  if (!customer || !pick(customer, fm.customer.name)) missing.push('customer');
  if (!lines.length) missing.push('invoice_lines');
  if (missing.length) {
    throw new ValidationError(`Missing required IFS data: ${missing.join(', ')}`, { missing });
  }

  const tin = pick(customer, fm.customer.tin);
  if (!tin) {
    throw new ValidationError('Missing TIN', {
      field: 'accounting_customer_party.tin',
      unresolved: 'Confirm Association No. is TIN (see mapping.config.js)',
    });
  }

  const invoiceType = pick(header, fm.header.invoiceType);
  const invoiceTypeCode = mapInvoiceTypeCode(invoiceType);
  if (!invoiceTypeCode) {
    throw new ValidationError('Unable to resolve invoice_type_code from IFS invoice_type', {
      invoiceType,
      hint: 'Configure INVOICE_TYPE_CODE_MAP_JSON',
    });
  }

  const transactionCategory = mapTransactionCategory(ifsInvoice);
  if (!transactionCategory) {
    throw new ValidationError('Unable to resolve transaction_category', {
      hint: 'Provide from IFS or set DEFAULT_TRANSACTION_CATEGORY after business confirmation',
    });
  }

  const street = joinAddressParts(
    pick(address, fm.address.address1),
    pick(address, fm.address.address2),
    pick(address, fm.address.address3)
  );
  const city = pick(address, fm.address.city);
  const country = pick(address, fm.address.country);
  if (!street || !city || !country) {
    throw new ValidationError('Missing customer invoice address fields', {
      street_name: street || null,
      city_name: city || null,
      country: country || null,
    });
  }

  const mappedLines = lines.map((line, index) => {
    const description = pick(line, fm.line.description);
    const hsn = pick(line, fm.line.hsnCode);
    const priceUnit = pick(line, fm.line.priceUnit);
    const taxCategoryRaw = pick(line, fm.line.taxCategoryId);
    const taxCategoryId = mapTaxCategoryId(taxCategoryRaw);
    const productCategory =
      pick(line, fm.line.productCategory) || config.mapping.defaults.productCategory;

    if (!hsn) {
      throw new ValidationError('Missing HSN', { lineIndex: index, field: 'hsn_code' });
    }
    if (!description) {
      throw new ValidationError('Missing line description', { lineIndex: index });
    }
    if (!priceUnit) {
      throw new ValidationError('Missing price_unit', { lineIndex: index });
    }
    if (!taxCategoryId) {
      throw new ValidationError('Invalid tax category', {
        lineIndex: index,
        vatCode: taxCategoryRaw,
        hint: 'Configure TAX_CATEGORY_MAP_JSON if platform categories differ from IFS vat_code',
      });
    }
    if (!productCategory) {
      throw new ValidationError('Missing product_category', {
        lineIndex: index,
        hint: 'Set DEFAULT_PRODUCT_CATEGORY or ensure catalog_no is present',
      });
    }

    const mapped = {
      internal_id: pick(line, fm.line.internalId) ?? null,
      description: String(description),
      invoiced_quantity: toNumber(pick(line, fm.line.invoicedQuantity), 'invoiced_quantity'),
      price_amount: toNumber(pick(line, fm.line.priceAmount), 'price_amount'),
      hsn_code: String(hsn),
      hsn_code_unit: config.mapping.defaults.hsnCodeUnit || null,
      price_unit: String(priceUnit),
      product_category: String(productCategory),
      tax_rate: toNumber(pick(line, fm.line.taxRate), 'tax_rate') ?? 0,
      tax_category_id: String(taxCategoryId),
      discount_rate: toNumber(pick(line, fm.line.discountRate), 'discount_rate'),
      base_quantity: toNumber(pick(line, fm.line.baseQuantity), 'base_quantity'),
      line_extension_amount: toNumber(pick(line, fm.line.lineExtensionAmount), 'line_extension_amount'),
    };

    return omitUndefined(mapped);
  });

  const paymentStatus = mapIFSStatusToPaymentStatus(pick(header, fm.header.objstate));
  const businessDescription =
    pick(customer, fm.customer.businessDescription) || config.mapping.defaults.businessDescription || null;

  const payload = {
    document_identifier: buildDocumentIdentifier({ header, company, seriesId, invoiceNo }),
    invoice_type: String(invoiceType || 'STANDARD'),
    issue_date: toDateOnly(pick(header, fm.header.invoiceDate)),
    due_date: toDateOnly(pick(header, fm.header.dueDate)),
    payment_status: paymentStatus,
    invoice_type_code: invoiceTypeCode,
    document_currency_code: String(pick(header, fm.header.currency) || ''),
    tax_currency_code: String(pick(header, fm.header.currency) || '') || null,
    transaction_category: transactionCategory,
    cancel_references: ifsInvoice.cancelReferences || [],
    accounting_customer_party: omitUndefined({
      party_name: String(pick(customer, fm.customer.name)),
      email: pick(contact, fm.contact.email) || null,
      telephone: pick(contact, fm.contact.telephone) || null,
      tin: String(tin),
      business_description: businessDescription,
      postal_address: {
        street_name: street,
        city_name: String(city),
        postal_zone: pick(address, fm.address.postalZone) || null,
        country: String(country).slice(0, 2).toUpperCase(),
      },
    }),
    invoice_lines: mappedLines,
  };

  if (!payload.issue_date) {
    throw new ValidationError('Missing issue_date');
  }
  if (!payload.document_currency_code) {
    throw new ValidationError('Missing document_currency_code');
  }

  return omitUndefined(payload);
}

module.exports = {
  mapCustomerInvoiceToEinvoice,
  buildDocumentIdentifier,
  mapInvoiceTypeCode,
  mapTaxCategoryId,
  joinAddressParts,
  toDateOnly,
  pick,
};
