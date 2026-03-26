const app = require('../src/app');

module.exports = function handler(req, res) {
  return app(req, res);
};
