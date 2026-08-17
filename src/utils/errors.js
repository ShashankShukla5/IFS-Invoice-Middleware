'use strict';

class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR', details = undefined, expose = false } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expose = expose;
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, { statusCode: 400, code: 'VALIDATION_ERROR', details, expose: true });
    this.name = 'ValidationError';
  }
}

class NotFoundError extends AppError {
  constructor(message, details) {
    super(message, { statusCode: 404, code: 'NOT_FOUND', details, expose: true });
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message, details) {
    super(message, { statusCode: 409, code: 'CONFLICT', details, expose: true });
    this.name = 'ConflictError';
  }
}

class ExternalApiError extends AppError {
  constructor(message, { statusCode = 502, code = 'EXTERNAL_API_ERROR', httpStatus, details } = {}) {
    super(message, { statusCode, code, details, expose: true });
    this.name = 'ExternalApiError';
    this.httpStatus = httpStatus;
  }
}

class IfsApiError extends AppError {
  constructor(message, { statusCode = 502, code = 'IFS_API_ERROR', httpStatus, details } = {}) {
    super(message, { statusCode, code, details, expose: true });
    this.name = 'IfsApiError';
    this.httpStatus = httpStatus;
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ExternalApiError,
  IfsApiError,
};
