const botController = require('./src/controllers/bot.controller');

module.exports = {
  handleWebhook: async (body) => botController.handleWebhook(body)
};
