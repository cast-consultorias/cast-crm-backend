const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const auth    = require('../middleware/auth');
const { getUserByEmail, updateLastLogin } = require('../services/sheets.service');
const { loginSchema, validate } = require('../utils/validators');

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { valid, error } = validate(loginSchema, req.body);
    if (!valid) return res.status(400).json({ error });

    const { email, password } = req.body;
    const user = await getUserByEmail(email);
    if (!user || !user.active) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

    await updateLastLogin(user.id);

    const payload = { userId:user.id, email:user.email, name:user.name, role:user.role, isCEO:user.isCEO, color:user.color, initials:user.initials };
    const token   = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

    res.json({ token, user: payload });
  } catch (e) { next(e); }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => res.json({ user: req.user }));

// POST /api/auth/logout
router.post('/logout', auth, (req, res) => res.json({ success: true }));

module.exports = router;
