'use strict';

const { config } = require('../config');
const { AppError } = require('../utils/errors');

/**
 * Protect Node endpoint when NODE_API_KEY is configured.
 * IFS should send: Authorization: Bearer <key>  OR  x-api-key: <key>
 */
function apiKeyAuth(req, res, next) {
  const expected = config.nodeApiKey;
  if (!expected) {
    return next();
  }

  const headerKey = req.headers['x-api-key'];
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const provided = headerKey || bearer;

  if (!provided || provided !== expected) {
    return next(new AppError('Unauthorized', { statusCode: 401, code: 'UNAUTHORIZED', expose: true }));
  }
  return next();
}

module.exports = { apiKeyAuth };
