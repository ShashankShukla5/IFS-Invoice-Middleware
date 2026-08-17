'use strict';

/**
 * Integration state repository contract.
 * Production: PrismaIntegrationStateRepository
 * Tests / no-DB: InMemoryIntegrationStateRepository
 */

class IntegrationStateRepository {
  async findByIdempotencyKey(_key) {
    throw new Error('Not implemented');
  }

  async create(_data) {
    throw new Error('Not implemented');
  }

  async update(_key, _data) {
    throw new Error('Not implemented');
  }

  async upsertReceived(_data) {
    throw new Error('Not implemented');
  }
}

function buildIdempotencyKey({ company, seriesId, invoiceNo }) {
  return `${company}|${seriesId}|${invoiceNo}`;
}

module.exports = { IntegrationStateRepository, buildIdempotencyKey };
