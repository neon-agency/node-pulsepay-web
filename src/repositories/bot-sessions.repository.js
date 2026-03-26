class BotSessionsRepository {
  constructor() {
    this.sessions = new Map();
  }

  getOrCreate(phone) {
    if (!this.sessions.has(phone)) {
      this.sessions.set(phone, { stage: 'START' });
    }

    return this.sessions.get(phone);
  }

  reset(phone) {
    const next = { stage: 'START' };
    this.sessions.set(phone, next);
    return next;
  }
}

module.exports = new BotSessionsRepository();
