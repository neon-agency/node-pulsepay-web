const db = require('../database/knex');

class ClientsRepository {
  mapRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      nome: row.nome,
      email: row.email,
      telefone: row.telefone,
      tipo: row.tipo,
      servidor: row.servidor_id,
      servidorUrl: row.servidor_url ?? null,
      login: row.login ?? null,
      senha: row.senha ?? null,
      plano: row.plano,
      status: row.status,
      vencimento: row.vencimento,
      statusVencimento: row.status_vencimento,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async enrichRows(rows = []) {
    if (!rows.length) return rows;

    const serverIds = Array.from(
      new Set(rows.map((row) => String(row.servidor_id || '').trim()).filter(Boolean))
    );
    const clientIds = Array.from(
      new Set(rows.map((row) => String(row.id || '').trim()).filter(Boolean))
    );

    const serverUrlById = new Map();
    if (serverIds.length) {
      const serverRows = await db('servers')
        .select('id', 'url')
        .whereIn('id', serverIds);
      for (const serverRow of serverRows) {
        serverUrlById.set(String(serverRow.id), serverRow.url ?? null);
      }
    }

    const loginByClientServer = new Map();
    if (clientIds.length && serverIds.length) {
      const credentialLinkRows = await db('credential_servers as cs')
        .innerJoin('credentials as cred', 'cred.id', 'cs.credential_id')
        .select(
          'cred.client_id as client_id',
          'cs.server_id as server_id',
          'cs.login as login',
          'cs.email as senha',
          'cs.created_at as created_at'
        )
        .whereIn('cred.client_id', clientIds)
        .whereIn('cs.server_id', serverIds)
        .orderBy('cs.created_at', 'desc');

      for (const link of credentialLinkRows) {
        const key = `${String(link.client_id)}::${String(link.server_id)}`;
        if (!loginByClientServer.has(key)) {
          loginByClientServer.set(key, {
            login: link.login ?? null,
            senha: link.senha ?? null
          });
        }
      }
    }

    return rows.map((row) => {
      const serverId = String(row.servidor_id || '').trim();
      const key = `${String(row.id)}::${serverId}`;
      const link = loginByClientServer.get(key) || null;

      return {
        ...row,
        servidor_url: serverUrlById.get(serverId) ?? null,
        login: link?.login ?? null,
        senha: link?.senha ?? null
      };
    });
  }

  async findAll(filters = {}) {
    const query = db('clients').select('*');

    if (filters.tipo) {
      query.where({ tipo: filters.tipo });
    }

    const rows = await query.orderBy('created_at', 'desc');
    const enrichedRows = await this.enrichRows(rows);
    return enrichedRows.map((row) => this.mapRow(row));
  }

  async findById(id) {
    const trimmed = String(id ?? '').trim();
    if (!trimmed) return null;
    const row = await db('clients').whereRaw('LOWER(id) = ?', [trimmed.toLowerCase()]).first();
    if (!row) return null;
    const [enrichedRow] = await this.enrichRows([row]);
    return this.mapRow(enrichedRow);
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
    const deleted = await db.transaction(async (trx) => {
      await trx('users')
        .where({ client_id: id })
        .del();

      const credentialIds = await trx('credentials')
        .where({ client_id: id })
        .pluck('id');

      if (credentialIds.length > 0) {
        await trx('recharge_requests')
          .whereIn('credential_id', credentialIds)
          .del();

        await trx('credentials')
          .where({ client_id: id })
          .del();
      }

      return trx('clients').where({ id }).del();
    });

    return deleted > 0;
  }
}

module.exports = new ClientsRepository();
