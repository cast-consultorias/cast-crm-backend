module.exports = (req, res, next) => {
  if (!req.user?.isCEO) {
    return res.status(403).json({ error: 'Esta acción requiere autorización del CEO' });
  }
  next();
};
