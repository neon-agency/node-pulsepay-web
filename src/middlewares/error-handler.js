module.exports = function errorHandler(error, req, res, _next) {
  const statusCode = error.statusCode || 500;

  const payload = {
    message: error.message || 'Erro interno do servidor'
  };

  if (error.details) {
    payload.details = error.details;
  }

  if (process.env.NODE_ENV !== 'production') {
    payload.stack = error.stack;
  }

  res.status(statusCode).json(payload);
};
