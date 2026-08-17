-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'SUCCESS', 'FAILED', 'ALREADY_GENERATED');

-- CreateTable
CREATE TABLE "invoice_integrations" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "invoiceId" TEXT,
    "documentIdentifier" TEXT,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'RECEIVED',
    "irn" TEXT,
    "qrUrl" TEXT,
    "correlationId" TEXT,
    "lastError" TEXT,
    "externalHttpStatus" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_integrations_idempotencyKey_key" ON "invoice_integrations"("idempotencyKey");

-- CreateIndex
CREATE INDEX "invoice_integrations_company_seriesId_invoiceNo_idx" ON "invoice_integrations"("company", "seriesId", "invoiceNo");

-- CreateIndex
CREATE INDEX "invoice_integrations_irn_idx" ON "invoice_integrations"("irn");
