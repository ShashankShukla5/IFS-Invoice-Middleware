'use strict';

const { z } = require('zod');
const { ValidationError } = require('../../utils/errors');

const postalAddressSchema = z.object({
  street_name: z.string().min(1),
  city_name: z.string().min(1),
  postal_zone: z.string().optional().nullable(),
  country: z.string().min(2).max(2),
});

const customerPartySchema = z.object({
  party_name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  telephone: z.string().optional().nullable(),
  tin: z.string().min(1, 'Customer TIN is required'),
  business_description: z.string().optional().nullable(),
  postal_address: postalAddressSchema,
});

const invoiceLineSchema = z.object({
  internal_id: z.union([z.string(), z.number()]).optional().nullable(),
  description: z.string().min(1),
  invoiced_quantity: z.number(),
  price_amount: z.number(),
  hsn_code: z.string().min(1, 'HSN code is required'),
  hsn_code_unit: z.string().optional().nullable(),
  price_unit: z.string().min(1),
  product_category: z.string().min(1, 'product_category is required'),
  tax_rate: z.number(),
  tax_category_id: z.string().min(1, 'tax_category_id is required'),
  discount_rate: z.number().optional().nullable(),
  base_quantity: z.number().optional().nullable(),
  line_extension_amount: z.number().optional().nullable(),
});

const cancelReferenceSchema = z.object({
  original_irn: z.string().min(1),
  original_issue_date: z.string().min(1),
});

const einvoicePayloadSchema = z.object({
  document_identifier: z.string().min(1),
  invoice_type: z.string().min(1),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  payment_status: z.enum(['PENDING', 'REJECTED', 'PAID']).optional().nullable(),
  invoice_type_code: z.enum(['380', '381', '384']),
  document_currency_code: z.string().min(1),
  tax_currency_code: z.string().optional().nullable(),
  transaction_category: z.enum(['B2B', 'B2C', 'B2G']),
  document_discount_rate: z.number().optional().nullable(),
  cancel_references: z.array(cancelReferenceSchema).optional().default([]),
  accounting_customer_party: customerPartySchema,
  invoice_lines: z.array(invoiceLineSchema).min(1, 'At least one invoice line is required'),
});

function omitUndefined(value) {
  if (Array.isArray(value)) return value.map(omitUndefined);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[k] = omitUndefined(v);
    }
    return out;
  }
  return value;
}

function validateEinvoicePayload(payload) {
  const result = einvoicePayloadSchema.safeParse(payload);
  if (!result.success) {
    throw new ValidationError('E-invoice payload validation failed', result.error.issues);
  }
  return omitUndefined(result.data);
}

module.exports = {
  validateEinvoicePayload,
  einvoicePayloadSchema,
  omitUndefined,
};
