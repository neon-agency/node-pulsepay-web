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
      clientId: row.client_id,
      clientNome: row.client_nome ?? null,
      clientTelefone: row.client_telefone ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findAll() {
    const rows = await db('credentials as c')
      .leftJoin('clients as cl', 'c.client_id', 'cl.id')
      .select(
        'c.id',
        'c.nome',
        'c.last4',
        'c.nome_normalized',
        'c.credential_key',
        'c.client_id',
        'c.created_at',
        'c.updated_at',
        'cl.nome as client_nome',
        'cl.telefone as client_telefone'
      )
      .orderBy('c.created_at', 'desc');
    return rows.map((row) => this.mapRow(row));
  }

  async findById(id) {
    const row = await db('credentials as c')
      .leftJoin('clients as cl', 'c.client_id', 'cl.id')
      .select(
        'c.id',
        'c.nome',
        'c.last4',
        'c.nome_normalized',
        'c.credential_key',
        'c.client_id',
        'c.created_at',
        'c.updated_at',
        'cl.nome as client_nome',
        'cl.telefone as client_telefone'
      )
      .where('c.id', id)
      .first();
    return this.mapRow(row);
  }

  async findByClientIdAndCredentialKey(clientId, credentialKey) {
    const row = await db('credentials')
      .where({ client_id: clientId, credential_key: credentialKey })
      .first();
    return this.mapRow(row);
  }

  async findAllByCredentialKey(credentialKey) {
    const rows = await db('credentials as c')
      .leftJoin('clients as cl', 'c.client_id', 'cl.id')
      .select(
        'c.id',
        'c.nome',
        'c.last4',
        'c.nome_normalized',
        'c.credential_key',
        'c.client_id',
        'c.created_at',
        'c.updated_at',
        'cl.nome as client_nome',
        'cl.telefone as client_telefone'
      )
      .where('c.credential_key', credentialKey);
    return rows.map((row) => this.mapRow(row));
  }

  async create(credential) {
    const payload = {
      id: credential.id,
      nome: credential.nome,
      last4: credential.last4,
      nome_normalized: credential.nomeNormalized,
      credential_key: credential.credentialKey,
      client_id: credential.clientId
    };

    const [inserted] = await db('credentials').insert(payload).returning('*');
    return this.findById(inserted.id);
  }

  async update(id, updates) {
    const payload = {
      nome: updates.nome,
      last4: updates.last4,
      nome_normalized: updates.nomeNormalized,
      credential_key: updates.credentialKey,
      client_id: updates.clientId,
      updated_at: db.fn.now()
    };

    await db('credentials').where({ id }).update(payload);
    return this.findById(id);
  }

  async remove(id) {
    const deleted = await db('credentials').where({ id }).del();
    return deleted > 0;
  }
}

module.exports = new CredentialsRepository();
