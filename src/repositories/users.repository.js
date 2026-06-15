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
      adminId: row.admin_id ?? null,
      whatsappPhone: row.whatsapp_phone,
      welcomePassword: row.welcome_password ?? null,
      tokenVersion: typeof row.token_version === 'number' ? row.token_version : 0,
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

  async findFirstAdmin() {
    const row = await db('users')
      .where({ is_active: true, role: 'admin' })
      .orderBy('created_at', 'asc')
      .first();
    return this.mapRow(row);
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
        admin_id: payload.adminId || null,
        whatsapp_phone: payload.whatsappPhone || null,
        welcome_password: payload.welcomePassword || null,
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

  async updateProfile(id, { name, email, passwordHash, welcomePassword }) {
    const updates = { updated_at: db.fn.now() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (passwordHash !== undefined) updates.password_hash = passwordHash;
    if (welcomePassword !== undefined) updates.welcome_password = welcomePassword;

    const [row] = await db('users')
      .where({ id })
      .update(updates)
      .returning('*');

    return this.mapRow(row);
  }

  async setActive(id, isActive) {
    const [row] = await db('users')
      .where({ id })
      .update({
        is_active: Boolean(isActive),
        updated_at: db.fn.now()
      })
      .returning('*');

    return this.mapRow(row);
  }

  async bumpTokenVersion(id) {
    const [row] = await db('users')
      .where({ id })
      .update({
        token_version: db.raw('token_version + 1'),
        updated_at: db.fn.now()
      })
      .returning('*');

    return this.mapRow(row);
  }
}

module.exports = new UsersRepository();
