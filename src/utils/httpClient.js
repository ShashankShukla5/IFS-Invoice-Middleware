'use strict';

const axios = require('axios');
const { logger } = require('./logger');

/**
 * Create an Axios instance. Never attach secrets into logs.
 */
function createHttpClient({ baseURL, timeout, headers = {}, name = 'http' } = {}) {
  const client = axios.create({
    baseURL: baseURL || undefined,
    timeout: timeout || 30000,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...headers,
    },
    validateStatus: () => true,
  });

  client.interceptors.request.use((req) => {
    logger.info(`${name} request started`, {
      method: req.method,
      url: req.url,
      baseURL: req.baseURL,
    });
    return req;
  });

  client.interceptors.response.use((res) => {
    logger.info(`${name} response received`, {
      method: res.config?.method,
      url: res.config?.url,
      status: res.status,
    });
    return res;
  });

  return client;
}

function isTimeoutError(error) {
  return error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT' || /timeout/i.test(error?.message || '');
}

function isNetworkError(error) {
  return Boolean(error?.request) && !error?.response;
}

module.exports = {
  createHttpClient,
  isTimeoutError,
  isNetworkError,
};
