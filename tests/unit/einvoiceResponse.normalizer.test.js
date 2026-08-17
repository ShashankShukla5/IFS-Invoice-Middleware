'use strict';

const { normalizeGenerateResponse, normalizeQrResponse } = require('../../src/services/einvoice/einvoiceResponse.normalizer');
const { successfulGenerateResponse } = require('../mocks/fixtures');

describe('einvoiceResponse.normalizer', () => {
  test('normalizes Cryptware generate success response', () => {
    const result = normalizeGenerateResponse(successfulGenerateResponse, 201);
    expect(result.success).toBe(true);
    expect(result.irn).toBe('CSWSIN007012-4DBC4AA6-20260125');
    expect(result.qrUrl).toContain('cloudinary');
    expect(result.status).toBe('SUCCESS');
  });

  test('handles malformed response', () => {
    const result = normalizeGenerateResponse(null, 200);
    expect(result.success).toBe(false);
    expect(result.status).toBe('MALFORMED_RESPONSE');
  });

  test('normalizes QR response', () => {
    const result = normalizeQrResponse({ data: { qr_code_url: 'https://example.com/qr.png' } }, 200);
    expect(result.success).toBe(true);
    expect(result.qrUrl).toBe('https://example.com/qr.png');
  });
});
