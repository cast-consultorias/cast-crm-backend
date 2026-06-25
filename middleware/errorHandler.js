module.exports = (err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  console.error(`[ERROR] ${req.method} ${req.path} ${status}:`, err.message);
  const isProd = process.env.NODE_ENV === 'production';
  // In production, hide internal details for 5xx errors to avoid leaking stack traces or DB info
  const message = (isProd && status >= 500)
    ? 'Error interno del servidor'
    : (err.message || 'Error interno del servidor');
  res.status(status).json({ error: message });
};
