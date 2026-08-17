'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const {
  setIntegrationStateRepository,
  resetIntegrationStateRepository,
} = require('../../src/repositories');
const { InMemoryIntegrationStateRepository } = require('../../src/repositories/inMemoryIntegrationState.repository');
const { IntegrationStatus } = require('../../src/constants/integrationStatus');
const { buildIdempotencyKey } = require('../../src/repositories/integrationState.repository');
const ifsInvoiceService = require('../../src/services/ifs/ifsInvoice.service');
const ifsInvoiceUpdateService = require('../../src/services/ifs/ifsInvoiceUpdate.service');
const einvoiceService = require('../../src/services/einvoice/einvoice.service');
const { buildIfsInvoice, successfulGenerateResponse } = require('../mocks/fixtures');
const { ExternalApiError, IfsApiError, NotFoundError } = require('../../src/utils/errors');

jest.mock('../../src/services/ifs/ifsInvoice.service');
jest.mock('../../src/services/ifs/ifsInvoiceUpdate.service');
jest.mock('../../src/services/einvoice/einvoice.service');

describe('POST /api/ifs/invoices — Customer Invoice flow', () => {
  let app;
  let repo;

  const auth = { 'x-api-key': 'test-node-api-key' };
  const validEvent = {
    company: '10',
    seriesId: 'INV',
    invoiceNo: '12345',
    invoiceId: 'INV-ID-12345',
  };

  beforeEach(() => {
    repo = new InMemoryIntegrationStateRepository();
    setIntegrationStateRepository(repo);
    app = createApp();
    jest.clearAllMocks();

    ifsInvoiceService.getCustomerInvoice.mockResolvedValue(buildIfsInvoice());
    ifsInvoiceUpdateService.updateEinvoiceDetails.mockResolvedValue({ success: true });
    einvoiceService.generateEinvoice.mockResolvedValue({
      success: true,
      status: 'SUCCESS',
      irn: successfulGenerateResponse.data.irn,
      qrUrl: successfulGenerateResponse.data.qr_code_url,
      externalId: successfulGenerateResponse.data.id,
    });
    einvoiceService.getInvoiceStatus.mockResolvedValue({
      success: false,
      irn: null,
      qrUrl: null,
    });
    einvoiceService.getQrCode.mockResolvedValue({
      success: true,
      qrUrl: successfulGenerateResponse.data.qr_code_url,
    });
  });

  afterEach(() => {
    resetIntegrationStateRepository();
  });

  // 1
  test('1. Valid IFS event starts processing', async () => {
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.code).toBe('SUCCESS');
    expect(res.headers['x-correlation-id']).toBeTruthy();
  });

  // 2
  test('2. Invalid event is rejected', async () => {
    const res = await request(app).post('/api/ifs/invoices').set(auth).send({ company: '10' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  // 3
  test('3. Invoice not found', async () => {
    ifsInvoiceService.getCustomerInvoice.mockRejectedValue(
      new NotFoundError('Invoice not found in IFS', validEvent)
    );
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  // 4
  test('4. Invoice status not Printed', async () => {
    ifsInvoiceService.getCustomerInvoice.mockResolvedValue(buildIfsInvoice({ objstate: 'Preliminary' }));
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not eligible/i);
  });

  // 5
  test('5. Invoice status Printed is eligible', async () => {
    ifsInvoiceService.getCustomerInvoice.mockResolvedValue(buildIfsInvoice({ objstate: 'Printed' }));
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(201);
    expect(einvoiceService.generateEinvoice).toHaveBeenCalled();
  });

  // 6
  test('6. Successful invoice generation', async () => {
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(201);
    expect(res.body.irn).toBe(successfulGenerateResponse.data.irn);
    expect(res.body.qrUrl).toBeTruthy();
    expect(res.body.status).toBe(IntegrationStatus.SUCCESS);
  });

  // 7
  test('7. Missing TIN', async () => {
    ifsInvoiceService.getCustomerInvoice.mockResolvedValue(buildIfsInvoice({ tin: null }));
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/TIN/i);
  });

  // 8
  test('8. Missing HSN', async () => {
    ifsInvoiceService.getCustomerInvoice.mockResolvedValue(buildIfsInvoice({ hsn: null }));
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/HSN/i);
  });

  // 9
  test('9. Missing customer', async () => {
    ifsInvoiceService.getCustomerInvoice.mockResolvedValue(buildIfsInvoice({ customer: false }));
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/customer/i);
  });

  // 10
  test('10. Missing invoice lines', async () => {
    ifsInvoiceService.getCustomerInvoice.mockResolvedValue(buildIfsInvoice({ lines: false }));
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/line/i);
  });

  // 11
  test('11. Invalid tax category', async () => {
    ifsInvoiceService.getCustomerInvoice.mockResolvedValue(buildIfsInvoice({ vatCode: null }));
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tax category/i);
  });

  // 12
  test('12. External API 400', async () => {
    einvoiceService.generateEinvoice.mockRejectedValue(
      new ExternalApiError('E-invoice API rejected the payload', {
        statusCode: 400,
        code: 'EINVOICE_BAD_REQUEST',
        httpStatus: 400,
      })
    );
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EINVOICE_BAD_REQUEST');
    const key = buildIdempotencyKey(validEvent);
    const state = await repo.findByIdempotencyKey(key);
    expect(state.status).toBe(IntegrationStatus.FAILED);
  });

  // 13
  test('13. External API 401/403', async () => {
    einvoiceService.generateEinvoice.mockRejectedValue(
      new ExternalApiError('E-invoice API authentication/authorization failed', {
        statusCode: 401,
        code: 'EINVOICE_AUTH_ERROR',
        httpStatus: 401,
      })
    );
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('EINVOICE_AUTH_ERROR');
  });

  // 14
  test('14. External API 409', async () => {
    einvoiceService.generateEinvoice.mockRejectedValue(
      new ExternalApiError('E-invoice conflict', {
        statusCode: 409,
        code: 'EINVOICE_CONFLICT',
        httpStatus: 409,
      })
    );
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EINVOICE_CONFLICT');
  });

  // 15
  test('15. External API 429', async () => {
    einvoiceService.generateEinvoice.mockRejectedValue(
      new ExternalApiError('E-invoice API rate limited', {
        statusCode: 429,
        code: 'EINVOICE_RATE_LIMITED',
        httpStatus: 429,
      })
    );
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('EINVOICE_RATE_LIMITED');
  });

  // 16
  test('16. External API 500', async () => {
    einvoiceService.generateEinvoice.mockRejectedValue(
      new ExternalApiError('E-invoice API server error', {
        statusCode: 502,
        code: 'EINVOICE_SERVER_ERROR',
        httpStatus: 500,
      })
    );
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('EINVOICE_SERVER_ERROR');
  });

  // 17
  test('17. Timeout — does not invent IRN; marks FAILED when status lookup empty', async () => {
    einvoiceService.generateEinvoice.mockRejectedValue(
      new ExternalApiError('E-invoice API timeout', {
        statusCode: 504,
        code: 'EINVOICE_TIMEOUT',
      })
    );
    einvoiceService.getInvoiceStatus.mockResolvedValue({ success: false, irn: null });
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(504);
    expect(res.body.code).toBe('EINVOICE_TIMEOUT');
    const state = await repo.findByIdempotencyKey(buildIdempotencyKey(validEvent));
    expect(state.status).toBe(IntegrationStatus.FAILED);
    expect(state.irn).toBeFalsy();
  });

  // 18
  test('18. Duplicate event after SUCCESS returns ALREADY_GENERATED', async () => {
    const first = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(second.status).toBe(200);
    expect(second.body.code).toBe('ALREADY_GENERATED');
    expect(einvoiceService.generateEinvoice).toHaveBeenCalledTimes(1);
  });

  // 19
  test('19. Existing IRN on IFS invoice skips generate', async () => {
    ifsInvoiceService.getCustomerInvoice.mockResolvedValue(
      buildIfsInvoice({ irn: 'EXISTING-IRN-001' })
    );
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('ALREADY_GENERATED');
    expect(res.body.irn).toBe('EXISTING-IRN-001');
    expect(einvoiceService.generateEinvoice).not.toHaveBeenCalled();
  });

  // 20
  test('20. QR retrieval failure', async () => {
    einvoiceService.generateEinvoice.mockResolvedValue({
      success: true,
      status: 'SUCCESS',
      irn: 'IRN-NO-QR',
      qrUrl: null,
    });
    einvoiceService.getQrCode.mockRejectedValue(
      new ExternalApiError('QR retrieval failed', {
        statusCode: 502,
        code: 'EINVOICE_QR_MISSING',
      })
    );
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('EINVOICE_QR_MISSING');
  });

  // 21
  test('21. IFS update failure', async () => {
    ifsInvoiceUpdateService.updateEinvoiceDetails.mockRejectedValue(
      new IfsApiError('IFS update failed', { code: 'IFS_HTTP_ERROR', httpStatus: 500 })
    );
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('IFS_HTTP_ERROR');
    const state = await repo.findByIdempotencyKey(buildIdempotencyKey(validEvent));
    expect(state.status).toBe(IntegrationStatus.FAILED);
    expect(state.irn).toBe(successfulGenerateResponse.data.irn);
  });

  // 22
  test('22. Complete successful flow', async () => {
    const res = await request(app).post('/api/ifs/invoices').set(auth).send(validEvent);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      code: 'SUCCESS',
      status: 'SUCCESS',
      irn: successfulGenerateResponse.data.irn,
      documentIdentifier: '10-INV-12345',
      company: '10',
      seriesId: 'INV',
      invoiceNo: '12345',
    });

    expect(ifsInvoiceService.getCustomerInvoice).toHaveBeenCalledWith(
      expect.objectContaining(validEvent)
    );
    expect(einvoiceService.generateEinvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        document_identifier: '10-INV-12345',
        invoice_type_code: '381',
        transaction_category: 'B2B',
      })
    );
    expect(ifsInvoiceUpdateService.updateEinvoiceDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        company: '10',
        seriesId: 'INV',
        invoiceNo: '12345',
        status: IntegrationStatus.SUCCESS,
        irn: successfulGenerateResponse.data.irn,
      })
    );

    const state = await repo.findByIdempotencyKey(buildIdempotencyKey(validEvent));
    expect(state.status).toBe(IntegrationStatus.SUCCESS);
    expect(state.irn).toBeTruthy();
    expect(state.qrUrl).toBeTruthy();
  });

  test('rejects unauthorized requests when API key configured', async () => {
    const res = await request(app).post('/api/ifs/invoices').send(validEvent);
    expect(res.status).toBe(401);
  });
});
