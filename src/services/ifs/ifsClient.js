'use strict';

const { config } = require('../../config');
const { createHttpClient, isTimeoutError, isNetworkError } = require('../../utils/httpClient');
const { IfsApiError } = require('../../utils/errors');
const { logger } = require('../../utils/logger');

let cachedToken = null;
let tokenExpiresAt = 0;

function assertIfsConfigured() {
  if (!config.ifs.baseUrl) {
    throw new IfsApiError('IFS_BASE_URL is not configured', { statusCode: 500, code: 'IFS_CONFIG_ERROR' });
  }
}

async function getAccessToken() {
  if (config.ifs.auth.accessToken) {
    return config.ifs.auth.accessToken;
  }

  if (!config.ifs.auth.tokenUrl || !config.ifs.auth.clientId || !config.ifs.auth.clientSecret) {
    throw new IfsApiError('IFS authentication is not configured', {
      statusCode: 500,
      code: 'IFS_AUTH_CONFIG_ERROR',
    });
  }

  if (cachedToken && Date.now() < tokenExpiresAt - 5000) {
    return cachedToken;
  }

  const tokenClient = createHttpClient({
    timeout: config.ifs.timeoutMs,
    name: 'ifs-auth',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  let response;
  try {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.ifs.auth.clientId,
      client_secret: config.ifs.auth.clientSecret,
    });
    response = await tokenClient.post(config.ifs.auth.tokenUrl, body.toString());
  } catch (error) {
    if (isTimeoutError(error) || isNetworkError(error)) {
      throw new IfsApiError('IFS auth token request failed (network/timeout)', {
        code: 'IFS_AUTH_NETWORK_ERROR',
      });
    }
    throw error;
  }

  if (response.status >= 400 || !response.data?.access_token) {
    throw new IfsApiError('IFS auth token request failed', {
      httpStatus: response.status,
      code: 'IFS_AUTH_FAILED',
    });
  }

  cachedToken = response.data.access_token;
  const expiresIn = Number(response.data.expires_in || 3600);
  tokenExpiresAt = Date.now() + expiresIn * 1000;
  return cachedToken;
}

function getIfsClient() {
  assertIfsConfigured();
  return createHttpClient({
    baseURL: config.ifs.baseUrl,
    timeout: config.ifs.timeoutMs,
    name: 'ifs',
  });
}

async function ifsRequest(method, endpoint, { params, data, headers } = {}) {
  if (!endpoint) {
    throw new IfsApiError('IFS endpoint is not configured', {
      statusCode: 500,
      code: 'IFS_ENDPOINT_NOT_CONFIGURED',
    });
  }

  const token = await getAccessToken();
  const client = getIfsClient();

  let response;
  try {
    response = await client.request({
      method,
      url: endpoint,
      params,
      data,
      headers: {
        Authorization: `Bearer ${token}`,
        ...headers,
      },
    });
  } catch (error) {
    logger.error('IFS request transport failure', {
      method,
      endpoint,
      code: error.code,
      message: error.message,
    });
    if (isTimeoutError(error)) {
      throw new IfsApiError('IFS request timed out', { code: 'IFS_TIMEOUT' });
    }
    if (isNetworkError(error)) {
      throw new IfsApiError('IFS network error', { code: 'IFS_NETWORK_ERROR' });
    }
    throw new IfsApiError('IFS request failed', { code: 'IFS_REQUEST_FAILED' });
  }

  if (response.status === 404) {
    throw new IfsApiError('IFS resource not found', {
      statusCode: 404,
      code: 'IFS_NOT_FOUND',
      httpStatus: 404,
    });
  }

  if (response.status >= 400) {
    throw new IfsApiError('IFS API error', {
      statusCode: 502,
      code: 'IFS_HTTP_ERROR',
      httpStatus: response.status,
    });
  }

  return response.data;
}

function resetIfsAuthCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

module.exports = {
  ifsRequest,
  getAccessToken,
  resetIfsAuthCache,
  assertIfsConfigured,
};
