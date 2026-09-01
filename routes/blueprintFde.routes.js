// Blueprints FDE+PMP™ — dominio distinto de /api/blueprint (Blueprint Session™ / IVC).
// No fusionar ni reutilizar rutas/tablas de ese módulo (ver docs/cast-strategy).
const router  = require('express').Router();
const auth    = require('../middleware/auth');
const svc     = require('../services/supabase.service');

// POST /api/blueprints-fde/:leadId — crear sesión
router.post('/:leadId', auth, async (req, res, next) => {
  try {
    const lead = await svc.getLeadById(req.params.leadId);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const session = await svc.createBpFdeSession(req.params.leadId, req.user.userId, req.user.role, { mode: req.body.mode });
    res.status(201).json({ session });
  } catch (e) { next(e); }
});

// GET /api/blueprints-fde/lead/:leadId — listar sesiones de un lead
router.get('/lead/:leadId', auth, async (req, res, next) => {
  try {
    const sessions = await svc.getBpFdeSessionsByLead(req.params.leadId);
    res.json({ sessions });
  } catch (e) { next(e); }
});

// GET /api/blueprints-fde/:sessionId — obtener una sesión
router.get('/:sessionId', auth, async (req, res, next) => {
  try {
    const session = await svc.getBpFdeSessionById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json({ session });
  } catch (e) { next(e); }
});

// PUT /api/blueprints-fde/:sessionId — actualizar campos editables (mode, fdeSupervisorId)
router.put('/:sessionId', auth, async (req, res, next) => {
  try {
    const session = await svc.updateBpFdeSession(req.params.sessionId, req.body, req.user.userId, req.user.role);
    res.json({ session });
  } catch (e) { next(e); }
});

// POST /api/blueprints-fde/:sessionId/status — transición de estado
router.post('/:sessionId/status', auth, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status requerido' });
    const session = await svc.transitionBpFdeSessionStatus(req.params.sessionId, status, req.user.userId, req.user.role);
    res.json({ session });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
    next(e);
  }
});

module.exports = router;
