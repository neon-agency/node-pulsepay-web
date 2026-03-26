const db = require('../database/knex');

class ClientsRepository {
  mapRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      nome: row.nome,
      email: row.email,
      servidor: row.servidor_id,
      plano: row.plano,
      status: row.status,
      vencimento: row.vencimento,
      statusVencimento: row.status_vencimento,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findAll() {
    const rows = await db('clients').select('*').orderBy('created_at', 'desc');
    return rows.map((row) => this.mapRow(row));
  }

  async findById(id) {
    const row = await db('clients').where({ id }).first();
    return this.mapRow(row);
  }

  async findByEmail(email) {
    const row = await db('clients').whereRaw('LOWER(email) = ?', [String(email).toLowerCase()]).first();
    return this.mapRow(row);
  }

  async create(client) {
    const payload = {
      ...client,
      servidor_id: client.servidor,
      status_vencimento: client.statusVencimento
    };

    delete payload.servidor;
    delete payload.statusVencimento;

    const [row] = await db('clients').insert(payload).returning('*');
    return this.mapRow(row);
  }

  async update(id, updates) {
    const payload = {
      ...updates,
      servidor_id: updates.servidor,
      status_vencimento: updates.statusVencimento,
      updated_at: db.fn.now()
    };

    delete payload.servidor;
    delete payload.statusVencimento;

    const [row] = await db('clients').where({ id }).update(payload).returning('*');
    return this.mapRow(row);
  }

  async remove(id) {
    const deleted = await db('clients').where({ id }).del();
    return deleted > 0;
  }
}

module.exports = new ClientsRepository();
