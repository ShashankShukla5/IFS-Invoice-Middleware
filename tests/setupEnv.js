process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.LOG_LEVEL = 'error';
process.env.NODE_API_KEY = 'test-node-api-key';
process.env.EINVOICE_BASE_URL = 'https://einvoice.test';
process.env.EINVOICE_API_KEY = 'test-einvoice-api-key';
process.env.EINVOICE_TIMEOUT_MS = '5000';
process.env.EINVOICE_STATUS_ENDPOINT = '/invoice/status';
process.env.EINVOICE_QR_ENDPOINT = '/invoice/qr';
process.env.IFS_BASE_URL = 'https://ifs.test';
process.env.IFS_INVOICE_ENDPOINT = '/main/ifsapplications/projection/v1/CustomerInvoiceHandling.svc/CustomerInvoices';
process.env.IFS_CUSTOMER_ENDPOINT = '/main/ifsapplications/projection/v1/CustomerInfoHandling.svc/CustomerInfos';
process.env.IFS_CUSTOMER_CONTACT_ENDPOINT = '/main/ifsapplications/projection/v1/CustomerInfoHandling.svc/CustomerContacts';
process.env.IFS_CUSTOMER_ADDRESS_ENDPOINT = '/main/ifsapplications/projection/v1/CustomerInfoHandling.svc/CustomerAddresses';
process.env.IFS_INVOICE_LINES_ENDPOINT = '/main/ifsapplications/projection/v1/CustomerInvoiceHandling.svc/CustomerInvoiceItems';
process.env.IFS_EINVOICE_UPDATE_ENDPOINT = '/main/ifsapplications/projection/v1/CustomerInvoiceHandling.svc/CustomerInvoices';
process.env.IFS_ACCESS_TOKEN = 'test-ifs-token';
process.env.DOCUMENT_IDENTIFIER_STRATEGY = 'COMPANY_SERIES_INVOICE_NO';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/ifs_einvoice_test?schema=public';
process.env.USE_IN_MEMORY_REPOSITORY = 'true';
process.env.DEFAULT_TRANSACTION_CATEGORY = 'B2B';
process.env.DEFAULT_PRODUCT_CATEGORY = 'General';
process.env.INVOICE_TYPE_CODE_MAP_JSON = JSON.stringify({
  STANDARD: '381',
  CUSTORDINV: '381',
  CREDIT: '380',
  DEBIT: '384',
});
process.env.TAX_CATEGORY_MAP_JSON = JSON.stringify({
  ZERO_VAT: 'ZERO_VAT',
  STANDARD_VAT: 'STANDARD_VAT',
  VAT0: 'ZERO_VAT',
  VAT75: 'STANDARD_VAT',
});
process.env.ELIGIBLE_IFS_STATUSES = 'Printed,PRINTED';
