'use strict';

const { config } = require('../../config');
const { createHttpClient, isTimeoutError, isNetworkError } = require('../../utils/httpClient');
const { ExternalApiError } = require('../../utils/errors');
const { logger } = require('../../utils/logger');
const {
  normalizeGenerateResponse,
  normalizeStatusResponse,
  normalizeQrResponse,
} = require('./einvoiceResponse.normalizer');

function getClient() {
  if (!config.einvoice.baseUrl) {
    throw new ExternalApiError('EINVOICE_BASE_URL is not configured', {
      statusCode: 500,
      code: 'EINVOICE_CONFIG_ERROR',
    });
  }
  if (!config.einvoice.apiKey) {
    throw new ExternalApiError('EINVOICE_API_KEY is not configured', {
      statusCode: 500,
      code: 'EINVOICE_CONFIG_ERROR',
    });
  }

  return createHttpClient({
    baseURL: config.einvoice.baseUrl,
    timeout: config.einvoice.timeoutMs,
    name: 'einvoice',
    headers: {
      'x-api-key': config.einvoice.apiKey,
    },
  });
}

function mapHttpError(status, data) {
  const messageFromApi = data?.message || data?.error || null;
  switch (status) {
    case 400:
      return new ExternalApiError(messageFromApi || 'E-invoice API rejected the payload', {
        statusCode: 400,
        code: 'EINVOICE_BAD_REQUEST',
        httpStatus: 400,
        details: data?.details,
      });
    case 401:
    case 403:
      return new ExternalApiError('E-invoice API authentication/authorization failed', {
        statusCode: status,
        code: 'EINVOICE_AUTH_ERROR',
        httpStatus: status,
      });
    case 409:
      return new ExternalApiError(messageFromApi || 'E-invoice conflict (possible duplicate)', {
        statusCode: 409,
        code: 'EINVOICE_CONFLICT',
        httpStatus: 409,
        details: data,
      });
    case 429:
      return new ExternalApiError('E-invoice API rate limited', {
        statusCode: 429,
        code: 'EINVOICE_RATE_LIMITED',
        httpStatus: 429,
      });
    default:
      if (status >= 500) {
        return new ExternalApiError('E-invoice API server error', {
          statusCode: 502,
          code: 'EINVOICE_SERVER_ERROR',
          httpStatus: status,
        });
      }
      return new ExternalApiError('E-invoice API error', {
        statusCode: 502,
        code: 'EINVOICE_HTTP_ERROR',
        httpStatus: status,
      });
  }
}

async function generateEinvoice(payload) {
  logger.info('external API request started', {
    path: '/invoice/generate',
    documentIdentifier: payload?.document_identifier,
  });

  const client = getClient();
  let response;
  try {
    response = await client.post('/invoice/generate', payload);
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new ExternalApiError('E-invoice API timeout', {
        statusCode: 504,
        code: 'EINVOICE_TIMEOUT',
      });
    }
    if (isNetworkError(error)) {
      throw new ExternalApiError('E-invoice API network error', {
        statusCode: 502,
        code: 'EINVOICE_NETWORK_ERROR',
      });
    }
    throw new ExternalApiError('E-invoice API request failed', {
      code: 'EINVOICE_REQUEST_FAILED',
    });
  }

  logger.info('external API HTTP status', { status: response.status });

  if (response.status >= 400) {
    throw mapHttpError(response.status, response.data);
  }

  const normalized = normalizeGenerateResponse(response.data, response.status);
  if (!normalized.success || !normalized.irn) {
    throw new ExternalApiError('Malformed e-invoice generate response', {
      statusCode: 502,
      code: 'EINVOICE_MALFORMED_RESPONSE',
      details: { httpStatus: response.status },
    });
  }

  logger.info('IRN generated', { irn: normalized.irn, hasQr: Boolean(normalized.qrUrl) });
  return normalized;
}

async function getInvoiceStatus({ documentIdentifier, irn }) {
  const client = getClient();
  let response;
  try {
    response = await client.get(config.einvoice.statusEndpoint, {
      params: {
        document_identifier: documentIdentifier,
        irn,
      },
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new ExternalApiError('E-invoice status timeout', {
        statusCode: 504,
        code: 'EINVOICE_STATUS_TIMEOUT',
      });
    }
    throw new ExternalApiError('E-invoice status request failed', {
      code: 'EINVOICE_STATUS_FAILED',
    });
  }

  if (response.status >= 400) {
    throw mapHttpError(response.status, response.data);
  }

  return normalizeStatusResponse(response.data, response.status);
}

async function getQrCode({ irn, documentIdentifier }) {
  const client = getClient();
  let response;
  try {
    response = await client.get(config.einvoice.qrEndpoint, {
      params: {
        irn,
        document_identifier: documentIdentifier,
      },
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new ExternalApiError('E-invoice QR timeout', {
        statusCode: 504,
        code: 'EINVOICE_QR_TIMEOUT',
      });
    }
    throw new ExternalApiError('E-invoice QR request failed', {
      code: 'EINVOICE_QR_FAILED',
    });
  }

  if (response.status >= 400) {
    throw mapHttpError(response.status, response.data);
  }

  const normalized = normalizeQrResponse(response.data, response.status);
  if (!normalized.success) {
    throw new ExternalApiError('QR retrieval failed', {
      statusCode: 502,
      code: 'EINVOICE_QR_MISSING',
    });
  }
  return normalized;
}

module.exports = {
  generateEinvoice,
  getInvoiceStatus,
  getQrCode,
  mapHttpError,
};
