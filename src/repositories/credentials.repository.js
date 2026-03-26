const db = require('../database/knex');

class CredentialsRepository {
  mapRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      nome: row.nome,
      last4: row.last4,
      nomeNormalized: row.nome_normalized,
      credentialKey: row.credential_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findAll() {
    const rows = await db('credentials').select('*').orderBy('created_at', 'desc');
    return rows.map((row) => this.mapRow(row));
  }

  async findById(id) {
    const row = await db('credentials').where({ id }).first();
    return this.mapRow(row);
  }

  async findByCredentialKey(credentialKey) {
    const row = await db('credentials').where({ credential_key: credentialKey }).first();
    return this.mapRow(row);
  }

  async create(credential) {
    const payload = {
      ...credential,
      nome_normalized: credential.nomeNormalized,
      credential_key: credential.credentialKey
    };

    delete payload.nomeNormalized;
    delete payload.credentialKey;

    const [row] = await db('credentials').insert(payload).returning('*');
    return this.mapRow(row);
  }

  async update(id, updates) {
    const payload = {
      ...updates,
      nome_normalized: updates.nomeNormalized,
      credential_key: updates.credentialKey,
      updated_at: db.fn.now()
    };

    delete payload.nomeNormalized;
    delete payload.credentialKey;

    const [row] = await db('credentials').where({ id }).update(payload).returning('*');
    return this.mapRow(row);
  }

  async remove(id) {
    const deleted = await db('credentials').where({ id }).del();
    return deleted > 0;
  }
}

module.exports = new CredentialsRepository();
