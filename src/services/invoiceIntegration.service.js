'use strict';

const { config } = require('../config');
const { logger } = require('../utils/logger');
const { IntegrationStatus } = require('../constants/integrationStatus');
const { buildIdempotencyKey } = require('../repositories/integrationState.repository');
const { getIntegrationStateRepository } = require('../repositories');
const { validateIfsEvent } = require('./validators/ifsEvent.validator');
const { validateEinvoicePayload } = require('./validators/einvoicePayload.validator');
const { mapCustomerInvoiceToEinvoice } = require('./mappers/customerInvoice.mapper');
const ifsInvoiceService = require('./ifs/ifsInvoice.service');
const ifsInvoiceUpdateService = require('./ifs/ifsInvoiceUpdate.service');
const einvoiceService = require('./einvoice/einvoice.service');
const { ValidationError, ConflictError } = require('../utils/errors');

function isEligibleStatus(objstate) {
  if (!objstate) return false;
  return config.mapping.eligibleStatuses.some(
    (s) => String(s).toLowerCase() === String(objstate).toLowerCase()
  );
}

function getHeaderStatus(header) {
  const fm = config.ifs.fieldMap.header;
  return header?.[fm.objstate] ?? header?.objstate ?? header?.Objstate ?? header?.state ?? null;
}

function getExistingIrn(header, record) {
  if (record?.irn) return record.irn;
  const fm = config.ifs.fieldMap.header;
  return header?.[fm.eInvoiceIrn] ?? header?.eInvoiceIrn ?? header?.E_INVOICE_IRN ?? null;
}

/**
 * Orchestrates: IFS event → fetch → map → validate → generate → update IFS → persist state.
 */
async function processCustomerInvoiceEvent(rawBody, { correlationId } = {}) {
  const event = validateIfsEvent(rawBody);
  const { company, seriesId, invoiceNo, invoiceId } = event;
  const idempotencyKey = buildIdempotencyKey(event);
  const repo = getIntegrationStateRepository();

  logger.info('event received', { correlationId, company, seriesId, invoiceNo, invoiceId });

  let record = await repo.upsertReceived({
    idempotencyKey,
    company,
    seriesId,
    invoiceNo,
    invoiceId: invoiceId || null,
    correlationId: correlationId || null,
    status: IntegrationStatus.RECEIVED,
  });

  // Idempotency: existing IRN / SUCCESS
  if (record.irn || record.status === IntegrationStatus.SUCCESS || record.status === IntegrationStatus.ALREADY_GENERATED) {
    logger.info('duplicate event / existing IRN — skipping generate', {
      correlationId,
      idempotencyKey,
      status: record.status,
      hasIrn: Boolean(record.irn),
    });
    return {
      success: true,
      code: 'ALREADY_GENERATED',
      status: IntegrationStatus.ALREADY_GENERATED,
      irn: record.irn || null,
      qrUrl: record.qrUrl || null,
      correlationId,
      company,
      seriesId,
      invoiceNo,
    };
  }

  if (record.status === IntegrationStatus.PROCESSING) {
    throw new ConflictError('Invoice integration already in progress', {
      idempotencyKey,
      status: record.status,
    });
  }

  logger.info('processing started', { correlationId, idempotencyKey });

  let ifsInvoice;
  try {
    ifsInvoice = await ifsInvoiceService.getCustomerInvoice(event);
  } catch (error) {
    await repo.update(idempotencyKey, {
      status: IntegrationStatus.FAILED,
      lastError: error.message,
    });
    throw error;
  }

  const objstate = getHeaderStatus(ifsInvoice.header);
  const existingIrn = getExistingIrn(ifsInvoice.header, record);
  if (existingIrn) {
    await repo.update(idempotencyKey, {
      status: IntegrationStatus.ALREADY_GENERATED,
      irn: existingIrn,
      documentIdentifier: `${company}-${seriesId}-${invoiceNo}`,
    });
    return {
      success: true,
      code: 'ALREADY_GENERATED',
      status: IntegrationStatus.ALREADY_GENERATED,
      irn: existingIrn,
      qrUrl: record.qrUrl || null,
      correlationId,
      company,
      seriesId,
      invoiceNo,
    };
  }

  if (!isEligibleStatus(objstate)) {
    const err = new ValidationError('Invoice status not eligible for e-invoice generation', {
      objstate,
      eligible: config.mapping.eligibleStatuses,
      hint: 'Integration triggers only when invoice reaches Printed',
    });
    await repo.update(idempotencyKey, {
      status: IntegrationStatus.FAILED,
      lastError: err.message,
    });
    throw err;
  }

  let payload;
  try {
    payload = mapCustomerInvoiceToEinvoice(ifsInvoice);
    payload = validateEinvoicePayload(payload);
  } catch (error) {
    await repo.update(idempotencyKey, {
      status: IntegrationStatus.FAILED,
      lastError: error.message,
    });
    throw error;
  }

  await repo.update(idempotencyKey, {
    status: IntegrationStatus.PROCESSING,
    documentIdentifier: payload.document_identifier,
    invoiceId: ifsInvoice.invoiceId || invoiceId || null,
  });

  let generated;
  try {
    generated = await einvoiceService.generateEinvoice(payload);
  } catch (error) {
    // Timeout / unknown outcome: attempt status lookup before failing hard
    if (error.code === 'EINVOICE_TIMEOUT' || error.code === 'EINVOICE_NETWORK_ERROR') {
      try {
        const lookup = await einvoiceService.getInvoiceStatus({
          documentIdentifier: payload.document_identifier,
        });
        if (lookup.success && lookup.irn) {
          generated = lookup;
        } else {
          throw error;
        }
      } catch {
        await repo.update(idempotencyKey, {
          status: IntegrationStatus.FAILED,
          lastError: error.message,
          externalHttpStatus: error.httpStatus || null,
        });
        try {
          await ifsInvoiceUpdateService.updateEinvoiceDetails({
            company,
            seriesId,
            invoiceNo,
            invoiceId: ifsInvoice.invoiceId,
            status: IntegrationStatus.FAILED,
            irn: null,
            qrUrl: null,
            error: error.message,
          });
        } catch {
          // swallow secondary IFS update failure after primary external failure
        }
        throw error;
      }
    } else {
      await repo.update(idempotencyKey, {
        status: IntegrationStatus.FAILED,
        lastError: error.message,
        externalHttpStatus: error.httpStatus || null,
      });
      try {
        await ifsInvoiceUpdateService.updateEinvoiceDetails({
          company,
          seriesId,
          invoiceNo,
          invoiceId: ifsInvoice.invoiceId,
          status: IntegrationStatus.FAILED,
          irn: null,
          qrUrl: null,
          error: error.message,
        });
      } catch {
        // ignore secondary failure
      }
      throw error;
    }
  }

  let qrUrl = generated.qrUrl;
  if (!qrUrl) {
    try {
      const qr = await einvoiceService.getQrCode({
        irn: generated.irn,
        documentIdentifier: payload.document_identifier,
      });
      qrUrl = qr.qrUrl;
    } catch (error) {
      await repo.update(idempotencyKey, {
        status: IntegrationStatus.FAILED,
        irn: generated.irn,
        lastError: error.message,
      });
      throw error;
    }
  }

  try {
    await ifsInvoiceUpdateService.updateEinvoiceDetails({
      company,
      seriesId,
      invoiceNo,
      invoiceId: ifsInvoice.invoiceId,
      status: IntegrationStatus.SUCCESS,
      irn: generated.irn,
      qrUrl,
      submittedAt: new Date().toISOString(),
      error: null,
    });
  } catch (error) {
    await repo.update(idempotencyKey, {
      status: IntegrationStatus.FAILED,
      irn: generated.irn,
      qrUrl,
      lastError: `IFS update failed: ${error.message}`,
    });
    throw error;
  }

  await repo.update(idempotencyKey, {
    status: IntegrationStatus.SUCCESS,
    irn: generated.irn,
    qrUrl,
    submittedAt: new Date(),
    lastError: null,
  });

  logger.info('final status', {
    correlationId,
    status: IntegrationStatus.SUCCESS,
    irn: generated.irn,
  });

  return {
    success: true,
    code: 'SUCCESS',
    status: IntegrationStatus.SUCCESS,
    irn: generated.irn,
    qrUrl,
    documentIdentifier: payload.document_identifier,
    correlationId,
    company,
    seriesId,
    invoiceNo,
  };
}

module.exports = {
  processCustomerInvoiceEvent,
  isEligibleStatus,
  getHeaderStatus,
};
