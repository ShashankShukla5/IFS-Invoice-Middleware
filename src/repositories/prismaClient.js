'use strict';

const { PrismaClient } = require('@prisma/client');
const { config } = require('../config');
const { logger } = require('../utils/logger');

let prisma;

function getPrisma() {
  if (config.useInMemoryRepository) {
    return null;
  }
  if (!prisma) {
    prisma = new PrismaClient({
      log: config.env === 'development' ? ['error', 'warn'] : ['error'],
    });
  }
  return prisma;
}

async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    logger.info('prisma disconnected');
  }
}

module.exports = { getPrisma, disconnectPrisma };
