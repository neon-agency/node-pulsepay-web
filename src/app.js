const express = require('express');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const serversRoutes = require('./routes/servers.routes');
const clientsRoutes = require('./routes/clients.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const credentialsRoutes = require('./routes/credentials.routes');
const rechargeOrdersRoutes = require('./routes/recharge-orders.routes');
const pixKeysRoutes = require('./routes/pix-keys.routes');
const whiteLabelRoutes = require('./routes/white-label.routes');
const userPreferencesRoutes = require('./routes/user-preferences.routes');
const noticesRoutes = require('./routes/notices.routes');
const invitesRoutes = require('./routes/invites.routes');
const storeSettingsRoutes = require('./routes/store-settings.routes');
const pushRoutes = require('./routes/push.routes');
const authMiddleware = require('./middlewares/auth.middleware');
const errorHandler = require('./middlewares/error-handler');

const app = express();

// Upload web chega como JSON + base64, entao o payload HTTP fica maior que o arquivo real.
app.use(express.json({ limit: '12mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);

app.use('/api/servers', serversRoutes);
app.use('/api/clients', authMiddleware, clientsRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api/recharge-orders', rechargeOrdersRoutes);
app.use('/api/pix-keys', pixKeysRoutes);
app.use('/api/white-label', whiteLabelRoutes);
app.use('/api/user-preferences', userPreferencesRoutes);
app.use('/api/notices', noticesRoutes);
app.use('/api/invites', invitesRoutes);
app.use('/api/store-settings', storeSettingsRoutes);
app.use('/api/push', pushRoutes);

app.use(errorHandler);

module.exports = app;
