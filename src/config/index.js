'use strict';

const { z } = require('zod');

function parseJsonObject(value, fallback = {}) {
  if (!value || String(value).trim() === '') return fallback;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return fallback;
  } catch {
    return fallback;
  }
}

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.string().default('info'),

  NODE_API_KEY: z.string().optional().default(''),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  USE_IN_MEMORY_REPOSITORY: z
    .string()
    .optional()
    .transform((v) => String(v).toLowerCase() === 'true'),

  IFS_BASE_URL: z.string().url().or(z.literal('')).default(''),
  IFS_INVOICE_ENDPOINT: z.string().default(''),
  IFS_CUSTOMER_ENDPOINT: z.string().default(''),
  IFS_CUSTOMER_CONTACT_ENDPOINT: z.string().default(''),
  IFS_CUSTOMER_ADDRESS_ENDPOINT: z.string().default(''),
  IFS_INVOICE_LINES_ENDPOINT: z.string().default(''),
  IFS_EINVOICE_UPDATE_ENDPOINT: z.string().default(''),
  IFS_TIMEOUT_MS: z.coerce.number().default(30000),
  IFS_AUTH_TOKEN_URL: z.string().optional().default(''),
  IFS_CLIENT_ID: z.string().optional().default(''),
  IFS_CLIENT_SECRET: z.string().optional().default(''),
  IFS_ACCESS_TOKEN: z.string().optional().default(''),

  /** Configurable IFS event attribute names */
  IFS_EVENT_ATTR_COMPANY: z.string().default('company'),
  IFS_EVENT_ATTR_SERIES_ID: z.string().default('seriesId'),
  IFS_EVENT_ATTR_INVOICE_NO: z.string().default('invoiceNo'),
  IFS_EVENT_ATTR_INVOICE_ID: z.string().default('invoiceId'),

  /** Configurable IFS response/field names (projection attribute names) */
  IFS_FIELD_MAP_JSON: z.string().optional().default(''),

  EINVOICE_BASE_URL: z.string().url().or(z.literal('')).default(''),
  EINVOICE_API_KEY: z.string().optional().default(''),
  EINVOICE_TIMEOUT_MS: z.coerce.number().default(30000),
  EINVOICE_STATUS_ENDPOINT: z.string().default('/invoice/status'),
  EINVOICE_QR_ENDPOINT: z.string().default('/invoice/qr'),

  DOCUMENT_IDENTIFIER_STRATEGY: z
    .enum(['COMPANY_SERIES_INVOICE_NO', 'INVOICE_ID'])
    .default('COMPANY_SERIES_INVOICE_NO'),

  /** Proposed mapping — must be confirmed by business */
  PAYMENT_STATUS_MAP_JSON: z.string().optional().default(''),
  INVOICE_TYPE_CODE_MAP_JSON: z.string().optional().default(''),
  TAX_CATEGORY_MAP_JSON: z.string().optional().default(''),
  DEFAULT_TRANSACTION_CATEGORY: z.string().optional().default(''),
  DEFAULT_PRODUCT_CATEGORY: z.string().optional().default(''),
  DEFAULT_BUSINESS_DESCRIPTION: z.string().optional().default(''),
  DEFAULT_HSN_CODE_UNIT: z.string().optional().default(''),

  ELIGIBLE_IFS_STATUSES: z.string().default('Printed,PRINTED'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

const env = parsed.data;

const defaultPaymentStatusMap = {
  Preliminary: 'PENDING',
  Printed: 'PENDING',
  PostedAuth: 'PENDING',
  PartlyPaidPosted: 'PENDING',
  PaidPosted: 'PAID',
};

const defaultInvoiceTypeCodeMap = {
  // Placeholders — confirm IFS invoice_type values against NRS codes
  // 381 = Invoice, 380 = Credit Note, 384 = Debit Note
};

const defaultFieldMap = {
  header: {
    company: 'company',
    seriesId: 'seriesId',
    invoiceNo: 'invoiceNo',
    invoiceId: 'invoiceId',
    invoiceType: 'invoiceType',
    invoiceDate: 'invoiceDate',
    dueDate: 'dueDate',
    currency: 'currency',
    objstate: 'objstate',
    identity: 'identity',
    invoiceAddressId: 'invoiceAddressId',
    eInvoiceStatus: 'eInvoiceStatus',
    eInvoiceIrn: 'eInvoiceIrn',
    eInvoiceQrUrl: 'eInvoiceQrUrl',
  },
  customer: {
    name: 'name',
    tin: 'associationNo',
    businessDescription: 'businessDescription',
  },
  contact: {
    email: 'email',
    telephone: 'phone',
  },
  address: {
    address1: 'address1',
    address2: 'address2',
    address3: 'address3',
    city: 'city',
    postalZone: 'zipCode',
    country: 'country',
  },
  line: {
    internalId: 'catalogNo',
    description: 'description',
    invoicedQuantity: 'invoicedQty',
    priceAmount: 'saleUnitPrice',
    hsnCode: 'hsnSacCode',
    priceUnit: 'priceUm',
    taxRate: 'vatRate',
    taxCategoryId: 'vatCode',
    discountRate: 'discount',
    lineExtensionAmount: 'netCurrAmount',
    baseQuantity: 'priceConv',
    productCategory: 'catalogNo',
  },
  update: {
    eInvoiceStatus: 'EInvoiceStatus',
    eInvoiceIrn: 'EInvoiceIrn',
    eInvoiceQrUrl: 'EInvoiceQrUrl',
    eInvoiceSubmittedAt: 'EInvoiceSubmittedAt',
    eInvoiceError: 'EInvoiceError',
  },
};

const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  nodeApiKey: env.NODE_API_KEY,
  databaseUrl: env.DATABASE_URL,
  useInMemoryRepository: env.USE_IN_MEMORY_REPOSITORY === true || env.NODE_ENV === 'test',

  ifs: {
    baseUrl: env.IFS_BASE_URL,
    timeoutMs: env.IFS_TIMEOUT_MS,
    endpoints: {
      invoice: env.IFS_INVOICE_ENDPOINT,
      customer: env.IFS_CUSTOMER_ENDPOINT,
      customerContact: env.IFS_CUSTOMER_CONTACT_ENDPOINT,
      customerAddress: env.IFS_CUSTOMER_ADDRESS_ENDPOINT,
      invoiceLines: env.IFS_INVOICE_LINES_ENDPOINT,
      einvoiceUpdate: env.IFS_EINVOICE_UPDATE_ENDPOINT,
    },
    auth: {
      tokenUrl: env.IFS_AUTH_TOKEN_URL,
      clientId: env.IFS_CLIENT_ID,
      clientSecret: env.IFS_CLIENT_SECRET,
      accessToken: env.IFS_ACCESS_TOKEN,
    },
    eventAttrs: {
      company: env.IFS_EVENT_ATTR_COMPANY,
      seriesId: env.IFS_EVENT_ATTR_SERIES_ID,
      invoiceNo: env.IFS_EVENT_ATTR_INVOICE_NO,
      invoiceId: env.IFS_EVENT_ATTR_INVOICE_ID,
    },
    fieldMap: {
      ...defaultFieldMap,
      ...parseJsonObject(env.IFS_FIELD_MAP_JSON, {}),
    },
  },

  einvoice: {
    baseUrl: env.EINVOICE_BASE_URL,
    apiKey: env.EINVOICE_API_KEY,
    timeoutMs: env.EINVOICE_TIMEOUT_MS,
    statusEndpoint: env.EINVOICE_STATUS_ENDPOINT,
    qrEndpoint: env.EINVOICE_QR_ENDPOINT,
  },

  mapping: {
    documentIdentifierStrategy: env.DOCUMENT_IDENTIFIER_STRATEGY,
    paymentStatusMap: {
      ...defaultPaymentStatusMap,
      ...parseJsonObject(env.PAYMENT_STATUS_MAP_JSON, {}),
    },
    invoiceTypeCodeMap: {
      ...defaultInvoiceTypeCodeMap,
      ...parseJsonObject(env.INVOICE_TYPE_CODE_MAP_JSON, {}),
    },
    taxCategoryMap: parseJsonObject(env.TAX_CATEGORY_MAP_JSON, {}),
    defaults: {
      transactionCategory: env.DEFAULT_TRANSACTION_CATEGORY || null,
      productCategory: env.DEFAULT_PRODUCT_CATEGORY || null,
      businessDescription: env.DEFAULT_BUSINESS_DESCRIPTION || null,
      hsnCodeUnit: env.DEFAULT_HSN_CODE_UNIT || null,
    },
    eligibleStatuses: env.ELIGIBLE_IFS_STATUSES.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
};

module.exports = { config, parseJsonObject };
