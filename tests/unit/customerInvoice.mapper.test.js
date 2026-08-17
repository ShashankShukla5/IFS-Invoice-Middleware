'use strict';

const { mapCustomerInvoiceToEinvoice, buildDocumentIdentifier } = require('../../src/services/mappers/customerInvoice.mapper');
const { buildIfsInvoice } = require('../mocks/fixtures');
const { ValidationError } = require('../../src/utils/errors');

describe('customerInvoice.mapper', () => {
  test('builds document_identifier as company-seriesId-invoiceNo', () => {
    const id = buildDocumentIdentifier({
      header: {},
      company: '10',
      seriesId: 'INV',
      invoiceNo: '12345',
    });
    expect(id).toBe('10-INV-12345');
  });

  test('maps a valid customer invoice', () => {
    const payload = mapCustomerInvoiceToEinvoice(buildIfsInvoice());
    expect(payload.document_identifier).toBe('10-INV-12345');
    expect(payload.invoice_type_code).toBe('381');
    expect(payload.accounting_customer_party.tin).toBe('23773131-0001');
    expect(payload.invoice_lines).toHaveLength(1);
    expect(payload.invoice_lines[0].hsn_code).toBe('11111222');
  });

  test('fails when TIN missing', () => {
    expect(() => mapCustomerInvoiceToEinvoice(buildIfsInvoice({ tin: null }))).toThrow(ValidationError);
  });

  test('fails when HSN missing', () => {
    expect(() => mapCustomerInvoiceToEinvoice(buildIfsInvoice({ hsn: null }))).toThrow(/HSN/i);
  });

  test('fails when customer missing', () => {
    expect(() => mapCustomerInvoiceToEinvoice(buildIfsInvoice({ customer: false }))).toThrow(/customer/i);
  });

  test('fails when lines missing', () => {
    expect(() => mapCustomerInvoiceToEinvoice(buildIfsInvoice({ lines: false }))).toThrow(/invoice_lines/i);
  });
});
