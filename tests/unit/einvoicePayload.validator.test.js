'use strict';

const { validateEinvoicePayload } = require('../../src/services/validators/einvoicePayload.validator');
const { ValidationError } = require('../../src/utils/errors');

describe('einvoicePayload.validator', () => {
  const valid = {
    document_identifier: '10-INV-12345',
    invoice_type: 'STANDARD',
    issue_date: '2026-03-13',
    due_date: '2026-03-20',
    payment_status: 'PENDING',
    invoice_type_code: '381',
    document_currency_code: 'NGN',
    tax_currency_code: 'NGN',
    transaction_category: 'B2B',
    cancel_references: [],
    accounting_customer_party: {
      party_name: 'Customer Name',
      email: 'customer@example.com',
      telephone: '+2348012345678',
      tin: '23773131-0001',
      postal_address: {
        street_name: '123 Customer Street',
        city_name: 'Lagos',
        postal_zone: '100001',
        country: 'NG',
      },
    },
    invoice_lines: [
      {
        description: 'Pharmaceutical materials',
        invoiced_quantity: 1,
        price_amount: 100,
        hsn_code: '11111222',
        price_unit: 'PC',
        product_category: 'General',
        tax_rate: 0,
        tax_category_id: 'ZERO_VAT',
      },
    ],
  };

  test('accepts a valid payload', () => {
    const result = validateEinvoicePayload(valid);
    expect(result.document_identifier).toBe('10-INV-12345');
  });

  test('rejects missing lines', () => {
    expect(() => validateEinvoicePayload({ ...valid, invoice_lines: [] })).toThrow(ValidationError);
  });
});
