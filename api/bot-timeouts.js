const idleTimeoutsService = require('../src/services/bot-idle-timeouts.service');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  const cronSecret = process.env.CRON_SECRET || null;
  const authHeader = req.headers.authorization || '';

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await idleTimeoutsService.processIdleSessions();
    return res.status(200).json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error('[BotTimeouts] Erro ao processar inatividade:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message
    });
  }
};
