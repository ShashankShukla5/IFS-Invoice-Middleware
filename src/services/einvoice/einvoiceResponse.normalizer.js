'use strict';

/**
 * Normalize Cryptware / NRS e-invoice API responses into a stable shape:
 * { success, status, irn, qrUrl, externalId, raw }
 */
function normalizeGenerateResponse(data, httpStatus) {
  if (!data || typeof data !== 'object') {
    return {
      success: false,
      status: 'MALFORMED_RESPONSE',
      irn: null,
      qrUrl: null,
      externalId: null,
      httpStatus,
      raw: data,
    };
  }

  const nested = data.data && typeof data.data === 'object' ? data.data : data;
  const irn = nested.irn || nested.IRN || nested.Irn || null;
  const qrUrl =
    nested.qr_code_url ||
    nested.qrUrl ||
    nested.qr_url ||
    nested.QRUrl ||
    nested.qrCodeUrl ||
    null;
  const externalId = nested.id || nested.invoice_id || nested.externalId || null;
  const statusRaw = nested.status || data.status || null;
  const successFlag =
    data.success === true ||
    String(data.status || '').toLowerCase() === 'success' ||
    Boolean(irn);
  const success = Boolean(successFlag && irn);

  return {
    success,
    // Contract status is SUCCESS/FAILED; preserve vendor status separately when useful
    status: success ? 'SUCCESS' : String(statusRaw || 'FAILED').toUpperCase(),
    vendorStatus: statusRaw ? String(statusRaw).toUpperCase() : null,
    irn: irn ? String(irn) : null,
    qrUrl: qrUrl ? String(qrUrl) : null,
    externalId: externalId ? String(externalId) : null,
    httpStatus,
    raw: data,
  };
}

function normalizeStatusResponse(data, httpStatus) {
  return normalizeGenerateResponse(data, httpStatus);
}

function normalizeQrResponse(data, httpStatus) {
  if (!data || typeof data !== 'object') {
    return { success: false, qrUrl: null, httpStatus, raw: data };
  }
  const nested = data.data && typeof data.data === 'object' ? data.data : data;
  const qrUrl =
    nested.qr_code_url || nested.qrUrl || nested.qr_url || nested.url || nested.QRUrl || null;
  return {
    success: Boolean(qrUrl),
    qrUrl: qrUrl ? String(qrUrl) : null,
    httpStatus,
    raw: data,
  };
}

module.exports = {
  normalizeGenerateResponse,
  normalizeStatusResponse,
  normalizeQrResponse,
};
