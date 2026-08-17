'use strict';

const { config } = require('../config');
const { InMemoryIntegrationStateRepository } = require('./inMemoryIntegrationState.repository');
const { PrismaIntegrationStateRepository } = require('./prismaIntegrationState.repository');

let singleton;

function getIntegrationStateRepository() {
  if (singleton) return singleton;
  if (config.useInMemoryRepository) {
    singleton = new InMemoryIntegrationStateRepository();
  } else {
    singleton = new PrismaIntegrationStateRepository();
  }
  return singleton;
}

function setIntegrationStateRepository(repo) {
  singleton = repo;
}

function resetIntegrationStateRepository() {
  singleton = null;
}

module.exports = {
  getIntegrationStateRepository,
  setIntegrationStateRepository,
  resetIntegrationStateRepository,
};
