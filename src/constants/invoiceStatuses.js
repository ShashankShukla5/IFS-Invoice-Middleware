'use strict';

/** IFS customer invoice lifecycle states (reference). */
const IfsInvoiceStatus = Object.freeze({
  PRELIMINARY: 'Preliminary',
  PRINTED: 'Printed',
  POSTED_AUTH: 'PostedAuth',
  PARTLY_PAID_POSTED: 'PartlyPaidPosted',
  PAID_POSTED: 'PaidPosted',
});

module.exports = { IfsInvoiceStatus };
