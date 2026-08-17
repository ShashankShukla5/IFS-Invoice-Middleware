# IFS → Nigerian E-Invoicing Middleware

Node.js (Express) middleware that receives IFS Customer Invoice business events, fetches invoice data via IFS REST/Projection APIs, maps to the Nigerian NRS e-invoice payload, calls Cryptware `/invoice/generate`, and writes IRN / QR URL / status back to IFS.

**Scope (v1):** Customer Invoice only. Project Invoice, Instant Invoice, and Credit/Debit notes are intentionally deferred (mapper leaves room for `cancel_references`).

## Architecture

```
POST /api/ifs/invoices
  → auth + correlation id
  → controller
  → invoiceIntegration.service (orchestrator)
       → idempotency (Prisma / in-memory)
       → ifsInvoice.service
       → customerInvoice.mapper
       → einvoicePayload.validator
       → einvoice.service
       → ifsInvoiceUpdate.service
```

## Quick start

```bash
cp .env.example .env
# Fill DATABASE_URL, IFS_* endpoints, EINVOICE_API_KEY, NODE_API_KEY, mapping JSON

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## Request contract (IFS → Node)

`POST /api/ifs/invoices`

Headers:
- `Content-Type: application/json`
- `x-api-key: <NODE_API_KEY>` (or `Authorization: Bearer <NODE_API_KEY>`)
- Optional: `x-correlation-id`

Body (attribute names configurable via `IFS_EVENT_ATTR_*`):

```json
{
  "company": "10",
  "seriesId": "INV",
  "invoiceNo": "12345",
  "invoiceId": "optional-if-unique-by-company-series-no"
}
```

Required: `company`, `seriesId`, `invoiceNo`.

## IFS REST endpoints

Configured only via environment — **not hard-coded / invented**:

| Env var | Purpose |
|---------|---------|
| `IFS_BASE_URL` | IFS Cloud base URL |
| `IFS_INVOICE_ENDPOINT` | Customer invoice header projection |
| `IFS_CUSTOMER_ENDPOINT` | Customer info |
| `IFS_CUSTOMER_CONTACT_ENDPOINT` | Primary contact |
| `IFS_CUSTOMER_ADDRESS_ENDPOINT` | Invoice address |
| `IFS_INVOICE_LINES_ENDPOINT` | Invoice lines |
| `IFS_EINVOICE_UPDATE_ENDPOINT` | PATCH IRN / QR / status |

Reference DB views for mapping (Node does **not** query Oracle):

- Header: `CUST_ORDER_INV_HEAD_UIV_ALL`
- Lines: `CUST_ORDER_INV_ITEM_UIV_ALL`

## Field mapping (Customer Invoice)

| E-invoice field | IFS source |
|-----------------|------------|
| `document_identifier` | `company-seriesId-invoiceNo` (`DOCUMENT_IDENTIFIER_STRATEGY=COMPANY_SERIES_INVOICE_NO`) |
| `invoice_type` | header `invoiceType` |
| `issue_date` | `invoiceDate` |
| `due_date` | `dueDate` |
| `document_currency_code` | `currency` |
| `party_name` | customer `name` |
| `email` / `telephone` | primary contact |
| `tin` | `associationNo` (**confirm = TIN**) |
| address | invoice address 1/2/3, city, zip, country |
| line `description` | `description` |
| `invoiced_quantity` | `invoicedQty` |
| `price_amount` | `saleUnitPrice` |
| `hsn_code` | `hsnSacCode` |
| `price_unit` | `priceUm` |
| `tax_rate` | `vatRate` |
| `tax_category_id` | `vatCode` (optional map via `TAX_CATEGORY_MAP_JSON`) |
| `discount_rate` | `discount` |
| `line_extension_amount` | `netCurrAmount` |

Unresolved mappings are documented in `src/config/mapping.config.js`.

## Unresolved assumptions (must confirm)

1. `invoice_type_code` — configure `INVOICE_TYPE_CODE_MAP_JSON` (381/380/384)
2. `transaction_category` — IFS statutory fee API vs `DEFAULT_TRANSACTION_CATEGORY`
3. `business_description` — no IFS source yet
4. `tin` — Association No. confirmation
5. `product_category` — `catalog_no` vs mapped category
6. `base_quantity` — `price_conv`
7. `tax_category_id` — raw `vat_code` vs NRS categories
8. `discount_rate` semantics
9. `hsn_code_unit` / `internal_id`
10. Payment status map (`PAYMENT_STATUS_MAP_JSON`)

## External API

`POST {EINVOICE_BASE_URL}/invoice/generate`  
Header: `x-api-key: ${EINVOICE_API_KEY}` (never logged)

Normalized response:

```json
{ "success": true, "status": "SUCCESS", "irn": "...", "qrUrl": "..." }
```

Services: `generateEinvoice()`, `getInvoiceStatus()`, `getQrCode()`.

## IFS update

`ifsInvoiceUpdate.service.updateEinvoiceDetails()` PATCHes configured projection fields:

- `EInvoiceStatus` / `E_INVOICE_STATUS`
- `EInvoiceIrn` / `E_INVOICE_IRN`
- `EInvoiceQrUrl` / `E_INVOICE_QR_URL`
- optional submitted-at / error

Exact attribute names overrideable via `IFS_FIELD_MAP_JSON`.

## Idempotency

Unique key: `company|seriesId|invoiceNo`  
States: `RECEIVED` → `PROCESSING` → `SUCCESS` | `FAILED` | `ALREADY_GENERATED`

Before generate: skip if local IRN exists, IFS already has IRN, or prior SUCCESS.

## Retry / errors

- External 400/401/403/409/429/500+ → mark `FAILED`, no fake IRN
- Timeout/network → status lookup by `document_identifier` before failing
- Never mark SUCCESS without IRN + IFS update

## Persistence

Production: PostgreSQL via Prisma (`InvoiceIntegration` model).  
Tests / local without DB: `USE_IN_MEMORY_REPOSITORY=true`.

## Tests

```bash
npm test
```

Covers the 22 required scenarios (valid/invalid event, not found, status gates, mapping failures, external HTTP errors, timeout, duplicate, existing IRN, QR failure, IFS update failure, full success).

## IFS configuration still required

1. Real projection URLs for invoice / customer / contact / address / lines / update
2. Custom attributes on Customer Invoice for status, IRN, QR, error, submitted-at
3. Business event on **Printed** only (not PostedAuth / PaidPosted)
4. Auth between IFS and this API (`NODE_API_KEY`)
5. Business confirmation of unresolved mappings above
