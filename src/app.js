const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const serversRoutes = require('./routes/servers.routes');
const clientsRoutes = require('./routes/clients.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const credentialsRoutes = require('./routes/credentials.routes');
const rechargeRequestsRoutes = require('./routes/recharge-requests.routes');
const botRoutes = require('./routes/bot.routes');
const pixKeysRoutes = require('./routes/pix-keys.routes');
const whiteLabelRoutes = require('./routes/white-label.routes');
const userPreferencesRoutes = require('./routes/user-preferences.routes');
const authMiddleware = require('./middlewares/auth.middleware');
const errorHandler = require('./middlewares/error-handler');

const app = express();

// Upload web chega como JSON + base64, entao o payload HTTP fica maior que o arquivo real.
app.use(express.json({ limit: '12mb' }));

app.use('/storage/logos', express.static(path.resolve(process.cwd(), 'storage', 'logos'), {
  maxAge: '7d',
  fallthrough: true,
}));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);

app.use('/api/servers', serversRoutes);
app.use('/api/clients', authMiddleware, clientsRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api/recharge-requests', rechargeRequestsRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/pix-keys', pixKeysRoutes);
app.use('/api/white-label', whiteLabelRoutes);
app.use('/api/user-preferences', userPreferencesRoutes);

app.use(errorHandler);

module.exports = app;
