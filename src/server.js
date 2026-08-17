'use strict';

require('dotenv').config();

const { createApp } = require('./app');
const { config } = require('./config');
const { logger } = require('./utils/logger');
const { disconnectPrisma } = require('./repositories/prismaClient');

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info('IFS e-invoicing middleware started', {
    port: config.port,
    env: config.env,
    documentIdentifierStrategy: config.mapping.documentIdentifierStrategy,
  });
});

async function shutdown(signal) {
  logger.info('shutdown signal received', { signal });
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { app, server };
