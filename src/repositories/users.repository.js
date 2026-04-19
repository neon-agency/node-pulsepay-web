const db = require('../database/knex');

class UsersRepository {
  mapRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      clientId: row.client_id ?? null,
      whatsappPhone: row.whatsapp_phone,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findByEmail(email) {
    const row = await db('users')
      .whereRaw('LOWER(email) = LOWER(?)', [email])
      .first();

    return this.mapRow(row);
  }

  async findById(id) {
    const row = await db('users').where({ id }).first();
    return this.mapRow(row);
  }

  async findAllActiveWithWhatsapp() {
    const rows = await db('users')
      .where({ is_active: true })
      .whereNotNull('whatsapp_phone')
      .orderBy('created_at', 'asc');

    return rows.map((row) => this.mapRow(row));
  }

  async findByClientId(clientId) {
    const row = await db('users').where({ client_id: clientId }).first();
    return this.mapRow(row);
  }

  async findAll() {
    const rows = await db('users').orderBy('created_at', 'asc');
    return rows.map((row) => this.mapRow(row));
  }

  async create(payload) {
    const [row] = await db('users')
      .insert({
        id: payload.id,
        name: payload.name,
        email: payload.email,
        password_hash: payload.passwordHash,
        role: payload.role,
        client_id: payload.clientId || null,
        whatsapp_phone: payload.whatsappPhone || null,
        is_active: payload.isActive ?? true
      })
      .returning('*');

    return this.mapRow(row);
  }

  async updateWhatsappPhone(id, whatsappPhone) {
    const [row] = await db('users')
      .where({ id })
      .update({
        whatsapp_phone: whatsappPhone,
        updated_at: db.fn.now()
      })
      .returning('*');

    return this.mapRow(row);
  }

  async updateProfile(id, { name, email, passwordHash }) {
    const updates = { updated_at: db.fn.now() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (passwordHash !== undefined) updates.password_hash = passwordHash;

    const [row] = await db('users')
      .where({ id })
      .update(updates)
      .returning('*');

    return this.mapRow(row);
  }
}

module.exports = new UsersRepository();
