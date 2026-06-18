const pushService = require('../services/push.service');

class PushController {
  async vapidPublicKey(_req, res) {
    return res.json({ publicKey: pushService.getPublicKey() });
  }

  async subscribe(req, res) {
    const saved = await pushService.saveSubscription(
      req.user?.id,
      req.body?.subscription,
      req.headers['user-agent']
    );
    return res.status(201).json({ ok: true, id: saved?.id ?? null });
  }

  async unsubscribe(req, res) {
    await pushService.removeSubscription(req.body?.endpoint);
    return res.json({ ok: true });
  }
}

module.exports = new PushController();
