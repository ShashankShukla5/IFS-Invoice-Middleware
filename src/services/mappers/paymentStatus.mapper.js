'use strict';

const { config } = require('../../config');

/**
 * Proposed IFS lifecycle → payment status mapping.
 * Must remain configurable until business confirms.
 */
function mapIFSStatusToPaymentStatus(ifsStatus) {
  if (ifsStatus == null || ifsStatus === '') return null;
  const map = config.mapping.paymentStatusMap || {};
  const direct = map[ifsStatus];
  if (direct) return direct;

  const normalized = String(ifsStatus).toLowerCase();
  const entry = Object.entries(map).find(([k]) => k.toLowerCase() === normalized);
  return entry ? entry[1] : null;
}

module.exports = { mapIFSStatusToPaymentStatus };
