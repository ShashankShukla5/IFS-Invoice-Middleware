'use strict';

function buildIfsInvoice({
  objstate = 'Printed',
  tin = '23773131-0001',
  hsn = '11111222',
  customer = true,
  lines = true,
  vatCode = 'ZERO_VAT',
  invoiceType = 'STANDARD',
  irn = null,
  identity = 'CUST001',
} = {}) {
  const header = {
    company: '10',
    seriesId: 'INV',
    invoiceNo: '12345',
    invoiceId: 'INV-ID-12345',
    invoiceType,
    invoiceDate: '2026-03-13',
    dueDate: '2026-03-20',
    currency: 'NGN',
    objstate,
    identity,
    invoiceAddressId: 'INVADDR',
    eInvoiceIrn: irn,
  };

  const customerObj = customer
    ? {
        identity,
        name: 'Customer Name',
        associationNo: tin,
        businessDescription: null,
      }
    : null;

  const contact = {
    identity,
    email: 'customer@example.com',
    phone: '+2348012345678',
    primary: true,
  };

  const address = {
    identity,
    addressId: 'INVADDR',
    address1: '123 Customer Street',
    address2: '',
    address3: '',
    city: 'Lagos',
    zipCode: '100001',
    country: 'NG',
  };

  const lineList = lines
    ? [
        {
          company: '10',
          seriesId: 'INV',
          invoiceNo: '12345',
          catalogNo: '1234536',
          description: 'Pharmaceutical materials',
          invoicedQty: 1,
          saleUnitPrice: 100,
          hsnSacCode: hsn,
          priceUm: 'PC',
          vatRate: 0,
          vatCode,
          discount: 10,
          priceConv: 1,
          netCurrAmount: 90,
        },
      ]
    : [];

  return {
    company: '10',
    seriesId: 'INV',
    invoiceNo: '12345',
    invoiceId: 'INV-ID-12345',
    header,
    customer: customerObj,
    contact,
    address,
    lines: lineList,
    cancelReferences: [],
  };
}

const successfulGenerateResponse = {
  status: 'success',
  message: 'Invoice created successfully',
  data: {
    id: '3f7d4083-4e2c-45b2-a68d-95e384765571',
    irn: 'CSWSIN007012-4DBC4AA6-20260125',
    status: 'VALIDATED',
    qr_code_url:
      'https://res.cloudinary.com/dxrqdbloy/image/upload/v1769384036/invoices/sample.png',
  },
};

module.exports = {
  buildIfsInvoice,
  successfulGenerateResponse,
};
