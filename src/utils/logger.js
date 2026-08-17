'use strict';

const winston = require('winston');
const { config } = require('../config');

const sensitiveKeys = [
  'apikey',
  'api_key',
  'x-api-key',
  'authorization',
  'password',
  'secret',
  'token',
  'client_secret',
  'ifs_client_secret',
  'einvoice_api_key',
  'node_api_key',
];

function redact(value) {
  if (value == null) return value;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
        out[k] = '[REDACTED]';
      } else if (k === 'accounting_customer_party' || k === 'invoice_lines' || k === 'payload') {
        out[k] = '[OMITTED_SENSITIVE_PAYLOAD]';
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const safeMeta = redact(meta);
      const metaStr = Object.keys(safeMeta).length ? ` ${JSON.stringify(safeMeta)}` : '';
      return `${timestamp} [${level}] ${message}${metaStr}`;
    })
  ),
  transports: [new winston.transports.Console({ silent: config.env === 'test' && config.logLevel === 'error' })],
});

module.exports = { logger, redact };
