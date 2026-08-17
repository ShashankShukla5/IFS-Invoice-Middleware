'use strict';

const { config } = require('../../config');
const { ifsRequest } = require('./ifsClient');
const { NotFoundError } = require('../../utils/errors');
const { logger } = require('../../utils/logger');

function unwrapOData(data) {
  if (!data) return null;
  if (Array.isArray(data.value)) return data.value;
  if (data.value) return data.value;
  return data;
}

function firstRecord(data) {
  const unwrapped = unwrapOData(data);
  if (Array.isArray(unwrapped)) return unwrapped[0] || null;
  return unwrapped || null;
}

/**
 * Retrieve customer invoice aggregate via configured IFS REST/Projection endpoints.
 * Endpoints must be supplied via environment — not invented.
 */
async function getCustomerInvoice({ company, seriesId, invoiceNo, invoiceId }) {
  logger.info('IFS retrieval started', { company, seriesId, invoiceNo, invoiceId });

  const headerFilter = invoiceId
    ? `invoiceId eq '${String(invoiceId).replace(/'/g, "''")}'`
    : `company eq '${String(company).replace(/'/g, "''")}' and seriesId eq '${String(seriesId).replace(/'/g, "''")}' and invoiceNo eq '${String(invoiceNo).replace(/'/g, "''")}'`;

  let headerData;
  try {
    headerData = await ifsRequest('GET', config.ifs.endpoints.invoice, {
      params: { $filter: headerFilter },
    });
  } catch (error) {
    if (error.code === 'IFS_NOT_FOUND') {
      throw new NotFoundError('Invoice not found in IFS', { company, seriesId, invoiceNo, invoiceId });
    }
    throw error;
  }

  const header = firstRecord(headerData);
  if (!header) {
    throw new NotFoundError('Invoice not found in IFS', { company, seriesId, invoiceNo, invoiceId });
  }

  const fm = config.ifs.fieldMap.header;
  const identity = header[fm.identity] ?? header.identity ?? header.Identity;
  const invoiceAddressId =
    header[fm.invoiceAddressId] ?? header.invoiceAddressId ?? header.InvoiceAddressId;

  const [customer, contact, address, linesData] = await Promise.all([
    identity
      ? ifsRequest('GET', config.ifs.endpoints.customer, {
          params: { $filter: `identity eq '${String(identity).replace(/'/g, "''")}'` },
        }).then(firstRecord)
      : Promise.resolve(null),
    identity
      ? ifsRequest('GET', config.ifs.endpoints.customerContact, {
          params: {
            $filter: `identity eq '${String(identity).replace(/'/g, "''")}' and primary eq true`,
          },
        })
          .then(firstRecord)
          .catch(() => null)
      : Promise.resolve(null),
    identity && invoiceAddressId
      ? ifsRequest('GET', config.ifs.endpoints.customerAddress, {
          params: {
            $filter: `identity eq '${String(identity).replace(/'/g, "''")}' and addressId eq '${String(invoiceAddressId).replace(/'/g, "''")}'`,
          },
        }).then(firstRecord)
      : Promise.resolve(null),
    ifsRequest('GET', config.ifs.endpoints.invoiceLines, {
      params: {
        $filter: `company eq '${String(company).replace(/'/g, "''")}' and seriesId eq '${String(seriesId).replace(/'/g, "''")}' and invoiceNo eq '${String(invoiceNo).replace(/'/g, "''")}'`,
      },
    }),
  ]);

  const lines = unwrapOData(linesData);
  const lineList = Array.isArray(lines) ? lines : lines ? [lines] : [];

  logger.info('IFS retrieval success', {
    company,
    seriesId,
    invoiceNo,
    lineCount: lineList.length,
    hasCustomer: Boolean(customer),
  });

  return {
    company,
    seriesId,
    invoiceNo,
    invoiceId: header[fm.invoiceId] ?? invoiceId ?? null,
    header,
    customer,
    contact,
    address,
    lines: lineList,
    // Reserved for credit/debit notes (original IRN lookup) — not populated in v1
    cancelReferences: [],
  };
}

module.exports = {
  getCustomerInvoice,
  unwrapOData,
  firstRecord,
};
