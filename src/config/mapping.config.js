'use strict';

/**
 * Unresolved / business-confirmation mappings.
 * Do NOT invent production values here — configure via env or confirm with business.
 *
 * Status legend (from IFS_EInvoicing_Field_Mapping.xlsx):
 * - CONFIRMED: safe to map from IFS fields
 * - REVIEW: candidate source exists; business must confirm
 * - MISSING: no IFS source identified yet
 */

const UNRESOLVED_MAPPINGS = Object.freeze({
  document_identifier: {
    status: 'REVIEW',
    defaultStrategy: 'COMPANY_SERIES_INVOICE_NO',
    note: 'Confirm whether displayed on invoice template or used only as unique id. Alternative: INVOICE_ID.',
  },
  invoice_type_code: {
    status: 'REVIEW',
    nrsCodes: { invoice: '381', creditNote: '380', debitNote: '384' },
    note: 'Map IFS invoice_type → NRS code via INVOICE_TYPE_CODE_MAP_JSON. Validation fails if unmapped.',
  },
  transaction_category: {
    status: 'REVIEW',
    candidates: ['STATUTORY_FEE_API.Get_Business_Trans_Type_Cust', 'Get_Code_Of_Supply'],
    note: 'Configure DEFAULT_TRANSACTION_CATEGORY only as temporary override after business confirmation.',
  },
  business_description: {
    status: 'MISSING',
    note: 'No IFS source identified. Optional in API; omit unless DEFAULT_BUSINESS_DESCRIPTION is set.',
  },
  tin: {
    status: 'REVIEW',
    candidate: 'CUSTOMER_INFO_API.Get_Association_No(identity)',
    note: 'Confirm Association No. is the TIN required by the Nigerian platform.',
  },
  product_category: {
    status: 'REVIEW',
    candidate: 'catalog_no',
    note: 'Confirm whether raw catalog_no is accepted or a category mapping is required.',
  },
  base_quantity: {
    status: 'REVIEW',
    candidate: 'price_conv',
    note: 'Customer Invoice uses price_conv; confirm semantics with business.',
  },
  tax_category_id: {
    status: 'REVIEW',
    candidate: 'vat_code',
    note: 'Map via TAX_CATEGORY_MAP_JSON if platform expects STANDARD_VAT/ZERO_VAT rather than IFS vat_code.',
  },
  discount_rate: {
    status: 'REVIEW',
    candidate: 'discount',
    note: 'Confirm whether order/additional discounts must also be included.',
  },
  hsn_code_unit: {
    status: 'MISSING',
    note: 'Optional. Configure DEFAULT_HSN_CODE_UNIT only after confirmation.',
  },
  internal_id: {
    status: 'REVIEW',
    candidate: 'catalog_no',
    note: 'Optional line field; mapped from catalog_no when present.',
  },
  payment_status: {
    status: 'REVIEW',
    note: 'Proposed IFS lifecycle → PENDING/REJECTED/PAID mapping is configurable via PAYMENT_STATUS_MAP_JSON.',
  },
});

module.exports = { UNRESOLVED_MAPPINGS };
