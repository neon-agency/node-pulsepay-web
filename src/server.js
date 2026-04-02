require('dotenv').config();
const app = require('./app');
const salesNotificationsService = require('./services/sales-notifications.service');

const PORT = Number(process.env.API_PORT || 3001);
const HOST = process.env.API_HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`API rodando em http://${HOST}:${PORT}`);
  salesNotificationsService.startWorker();
});
