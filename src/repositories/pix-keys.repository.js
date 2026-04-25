const db = require('../database/knex');

class PixKeysRepository {
  mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      tipo: row.tipo,
      chave: row.chave,
      nomeTitular: row.nome_titular,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findAllByUser(userId) {
    const rows = await db('pix_keys')
      .where({ user_id: userId })
      .orderBy([{ column: 'is_default', order: 'desc' }, { column: 'created_at', order: 'asc' }]);
    return rows.map((row) => this.mapRow(row));
  }

  async findById(id) {
    const row = await db('pix_keys').where({ id }).first();
    return this.mapRow(row);
  }

  async countByUser(userId) {
    const result = await db('pix_keys').where({ user_id: userId }).count({ total: '*' }).first();
    return Number(result?.total ?? 0);
  }

  async findDefaultByUser(userId) {
    const row = await db('pix_keys').where({ user_id: userId, is_default: true }).first();
    return this.mapRow(row);
  }

  async create(payload) {
    return db.transaction(async (trx) => {
      if (payload.isDefault) {
        await trx('pix_keys')
          .where({ user_id: payload.userId })
          .update({ is_default: false, updated_at: trx.fn.now() });
      }
      const [row] = await trx('pix_keys')
        .insert({
          id: payload.id,
          user_id: payload.userId,
          tipo: payload.tipo,
          chave: payload.chave,
          nome_titular: payload.nomeTitular,
          is_default: payload.isDefault ?? false
        })
        .returning('*');
      return this.mapRow(row);
    });
  }

  async update(id, userId, updates) {
    return db.transaction(async (trx) => {
      if (updates.isDefault) {
        await trx('pix_keys')
          .where({ user_id: userId })
          .whereNot({ id })
          .update({ is_default: false, updated_at: trx.fn.now() });
      }
      const patch = { updated_at: trx.fn.now() };
      if (updates.tipo !== undefined) patch.tipo = updates.tipo;
      if (updates.chave !== undefined) patch.chave = updates.chave;
      if (updates.nomeTitular !== undefined) patch.nome_titular = updates.nomeTitular;
      if (updates.isDefault !== undefined) patch.is_default = updates.isDefault;
      const [row] = await trx('pix_keys')
        .where({ id, user_id: userId })
        .update(patch)
        .returning('*');
      return this.mapRow(row);
    });
  }

  async delete(id, userId) {
    return db.transaction(async (trx) => {
      const existing = await trx('pix_keys').where({ id, user_id: userId }).first();
      if (!existing) return false;
      await trx('pix_keys').where({ id, user_id: userId }).delete();
      if (existing.is_default) {
        const [next] = await trx('pix_keys')
          .where({ user_id: userId })
          .orderBy('created_at', 'asc')
          .limit(1);
        if (next) {
          await trx('pix_keys')
            .where({ id: next.id })
            .update({ is_default: true, updated_at: trx.fn.now() });
        }
      }
      return true;
    });
  }
}

module.exports = new PixKeysRepository();
