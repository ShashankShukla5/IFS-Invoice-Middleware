'use strict';

const { asyncHandler } = require('../middleware/errorHandler');
const { processCustomerInvoiceEvent } = require('../services/invoiceIntegration.service');
const { logger } = require('../utils/logger');

const postIfsInvoice = asyncHandler(async (req, res) => {
  logger.info('IFS invoice event endpoint hit', { correlationId: req.correlationId });

  const result = await processCustomerInvoiceEvent(req.body, {
    correlationId: req.correlationId,
  });

  const statusCode = result.code === 'ALREADY_GENERATED' ? 200 : 201;
  res.status(statusCode).json(result);
});

module.exports = { postIfsInvoice };
