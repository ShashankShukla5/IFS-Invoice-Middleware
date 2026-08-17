'use strict';

const { config } = require('../../config');
const { ifsRequest } = require('./ifsClient');
const { IfsApiError } = require('../../utils/errors');
const { logger } = require('../../utils/logger');

/**
 * Update e-invoice details on IFS via REST/Projection (never direct Oracle).
 *
 * Expected IFS custom attributes (configure projection field names via IFS_FIELD_MAP_JSON):
 * - E_INVOICE_STATUS
 * - E_INVOICE_IRN
 * - E_INVOICE_QR_URL
 * - E_INVOICE_SUBMITTED_AT (optional)
 * - E_INVOICE_ERROR (optional)
 */
async function updateEinvoiceDetails({
  company,
  seriesId,
  invoiceNo,
  invoiceId,
  status,
  irn,
  qrUrl,
  submittedAt,
  error,
}) {
  const endpoint = config.ifs.endpoints.einvoiceUpdate;
  if (!endpoint) {
    throw new IfsApiError('IFS_EINVOICE_UPDATE_ENDPOINT is not configured', {
      statusCode: 500,
      code: 'IFS_UPDATE_ENDPOINT_NOT_CONFIGURED',
    });
  }

  const uf = config.ifs.fieldMap.update;
  const payload = {
    [uf.eInvoiceStatus]: status,
    [uf.eInvoiceIrn]: irn ?? null,
    [uf.eInvoiceQrUrl]: qrUrl ?? null,
  };
  if (submittedAt !== undefined) {
    payload[uf.eInvoiceSubmittedAt] = submittedAt;
  }
  if (error !== undefined) {
    payload[uf.eInvoiceError] = error;
  }

  logger.info('IFS update started', { company, seriesId, invoiceNo, status, hasIrn: Boolean(irn) });

  // Prefer key-based PATCH when invoiceId is known; otherwise filter-based update path.
  // Exact URL shape depends on the IFS projection — keep key construction configurable.
  const keySegment = invoiceId
    ? `(InvoiceId='${encodeURIComponent(String(invoiceId))}')`
    : `(Company='${encodeURIComponent(company)}',SeriesId='${encodeURIComponent(seriesId)}',InvoiceNo='${encodeURIComponent(invoiceNo)}')`;

  const url = `${endpoint.replace(/\/$/, '')}${keySegment}`;

  try {
    await ifsRequest('PATCH', url, {
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'If-Match': '*',
      },
    });
  } catch (err) {
    logger.error('IFS update failure', {
      company,
      seriesId,
      invoiceNo,
      code: err.code,
      message: err.message,
    });
    throw err;
  }

  logger.info('IFS update success', { company, seriesId, invoiceNo, status });
  return { success: true };
}

module.exports = { updateEinvoiceDetails };
