'use strict';

const { v4: uuidv4 } = require('uuid');

function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-correlation-id'] || req.headers['x-request-id'];
  const correlationId = typeof incoming === 'string' && incoming.trim() ? incoming.trim() : uuidv4();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}

module.exports = { requestIdMiddleware };
