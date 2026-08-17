'use strict';

const IntegrationStatus = Object.freeze({
  RECEIVED: 'RECEIVED',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  ALREADY_GENERATED: 'ALREADY_GENERATED',
});

module.exports = { IntegrationStatus };
