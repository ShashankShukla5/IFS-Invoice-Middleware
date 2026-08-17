'use strict';

const { IntegrationStateRepository } = require('./integrationState.repository');

class InMemoryIntegrationStateRepository extends IntegrationStateRepository {
  constructor() {
    super();
    this.store = new Map();
  }

  async findByIdempotencyKey(key) {
    return this.store.get(key) || null;
  }

  async create(data) {
    const now = new Date();
    const record = {
      id: data.id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    this.store.set(data.idempotencyKey, record);
    return { ...record };
  }

  async update(key, data) {
    const existing = this.store.get(key);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.store.set(key, updated);
    return { ...updated };
  }

  async upsertReceived(data) {
    const existing = await this.findByIdempotencyKey(data.idempotencyKey);
    if (existing) return { ...existing };
    return this.create({
      ...data,
      status: data.status || 'RECEIVED',
    });
  }

  clear() {
    this.store.clear();
  }
}

module.exports = { InMemoryIntegrationStateRepository };
