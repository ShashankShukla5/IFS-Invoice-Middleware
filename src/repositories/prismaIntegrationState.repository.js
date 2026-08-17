'use strict';

const { IntegrationStateRepository } = require('./integrationState.repository');
const { getPrisma } = require('./prismaClient');

class PrismaIntegrationStateRepository extends IntegrationStateRepository {
  constructor(prismaClient) {
    super();
    this.prisma = prismaClient || getPrisma();
    if (!this.prisma) {
      throw new Error('Prisma client is not available. Set DATABASE_URL and USE_IN_MEMORY_REPOSITORY=false.');
    }
  }

  async findByIdempotencyKey(key) {
    return this.prisma.invoiceIntegration.findUnique({ where: { idempotencyKey: key } });
  }

  async create(data) {
    return this.prisma.invoiceIntegration.create({ data });
  }

  async update(key, data) {
    return this.prisma.invoiceIntegration.update({
      where: { idempotencyKey: key },
      data,
    });
  }

  async upsertReceived(data) {
    return this.prisma.invoiceIntegration.upsert({
      where: { idempotencyKey: data.idempotencyKey },
      create: {
        ...data,
        status: data.status || 'RECEIVED',
      },
      update: {
        correlationId: data.correlationId,
        invoiceId: data.invoiceId,
      },
    });
  }
}

module.exports = { PrismaIntegrationStateRepository };
