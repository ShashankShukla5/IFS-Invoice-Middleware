'use strict';

const { z } = require('zod');
const { config } = require('../../config');
const { ValidationError } = require('../../utils/errors');

function normalizeIfsEvent(body = {}) {
  const attrs = config.ifs.eventAttrs;
  return {
    company: body[attrs.company] ?? body.company,
    seriesId: body[attrs.seriesId] ?? body.seriesId ?? body.series_id,
    invoiceNo: body[attrs.invoiceNo] ?? body.invoiceNo ?? body.invoice_no,
    invoiceId: body[attrs.invoiceId] ?? body.invoiceId ?? body.invoice_id,
  };
}

const ifsEventSchema = z.object({
  company: z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1)),
  seriesId: z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1)),
  invoiceNo: z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1)),
  invoiceId: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .optional()
    .transform((v) => (v == null || v === '' ? undefined : String(v))),
});

function validateIfsEvent(body) {
  const normalized = normalizeIfsEvent(body);
  const result = ifsEventSchema.safeParse(normalized);
  if (!result.success) {
    throw new ValidationError('Invalid IFS event payload', result.error.issues);
  }
  return result.data;
}

module.exports = { validateIfsEvent, normalizeIfsEvent, ifsEventSchema };
