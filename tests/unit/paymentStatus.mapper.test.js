'use strict';

const { mapIFSStatusToPaymentStatus } = require('../../src/services/mappers/paymentStatus.mapper');

describe('paymentStatus.mapper', () => {
  test('maps Printed to PENDING (proposed)', () => {
    expect(mapIFSStatusToPaymentStatus('Printed')).toBe('PENDING');
  });

  test('maps PaidPosted to PAID (proposed)', () => {
    expect(mapIFSStatusToPaymentStatus('PaidPosted')).toBe('PAID');
  });

  test('returns null for unknown status', () => {
    expect(mapIFSStatusToPaymentStatus('SomethingElse')).toBeNull();
  });
});
