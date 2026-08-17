'use strict';

const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');

function errorHandler(err, req, res, _next) {
  const correlationId = req.correlationId;
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const expose = err.expose === true || statusCode < 500;

  logger.error('request failed', {
    correlationId,
    code,
    statusCode,
    message: err.message,
    details: err.details,
  });

  res.status(statusCode).json({
    success: false,
    code,
    message: expose ? err.message : 'An unexpected error occurred',
    correlationId,
    ...(expose && err.details ? { details: err.details } : {}),
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    code: 'ROUTE_NOT_FOUND',
    message: 'Route not found',
    correlationId: req.correlationId,
  });
}

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, notFoundHandler, asyncHandler, AppError };
