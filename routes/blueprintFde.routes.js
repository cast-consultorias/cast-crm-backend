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

// GET /api/blueprints-fde/questions — banco de preguntas (§07). Debe ir ANTES de
// GET /:sessionId — mismo número de segmentos, si no Express confunde "questions" con un id.
router.get('/questions', auth, async (req, res, next) => {
  try {
    const version = parseInt(req.query.version) || 1;
    const bank = await svc.getBpFdeQuestionBank(version);
    res.json(bank);
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

// GET /api/blueprints-fde/:sessionId/answers — respuestas de una sesión
router.get('/:sessionId/answers', auth, async (req, res, next) => {
  try {
    const answers = await svc.getBpFdeAnswers(req.params.sessionId);
    res.json({ answers });
  } catch (e) { next(e); }
});

// PUT /api/blueprints-fde/:sessionId/answers/:questionCode — guardar/editar una respuesta (✎ Escribir / 🎙 Hablar)
router.put('/:sessionId/answers/:questionCode', auth, async (req, res, next) => {
  try {
    const { answerText, questionSetVersion, capturedVia } = req.body;
    const answer = await svc.upsertBpFdeAnswer(
      req.params.sessionId, req.params.questionCode, questionSetVersion || 1,
      answerText, req.user.userId, req.user.role, capturedVia || 'text'
    );
    res.json({ answer });
  } catch (e) { next(e); }
});

// GET /api/blueprints-fde/:sessionId/voice-consent — consentimiento vigente (o null si no se ha pedido)
router.get('/:sessionId/voice-consent', auth, async (req, res, next) => {
  try {
    const consent = await svc.getBpFdeVoiceConsent(req.params.sessionId);
    res.json({ consent });
  } catch (e) { next(e); }
});

// POST /api/blueprints-fde/:sessionId/voice-consent — registrar decisión de consentimiento (§09, AC09)
router.post('/:sessionId/voice-consent', auth, async (req, res, next) => {
  try {
    if (typeof req.body.authorized !== 'boolean') return res.status(400).json({ error: 'authorized (boolean) requerido' });
    const consent = await svc.setBpFdeVoiceConsent(req.params.sessionId, req.body.authorized, req.user.userId, req.user.role);
    res.status(201).json({ consent });
  } catch (e) { next(e); }
});

// GET /api/blueprints-fde/:sessionId/transcripts — transcripciones de la sesión
router.get('/:sessionId/transcripts', auth, async (req, res, next) => {
  try {
    const transcripts = await svc.getBpFdeTranscripts(req.params.sessionId);
    res.json({ transcripts });
  } catch (e) { next(e); }
});

// POST /api/blueprints-fde/:sessionId/transcripts — registrar una transcripción capturada por voz
router.post('/:sessionId/transcripts', auth, async (req, res, next) => {
  try {
    const consent = await svc.getBpFdeVoiceConsent(req.params.sessionId);
    if (!consent?.authorized) return res.status(403).json({ error: 'No hay consentimiento de grabación registrado para esta sesión' });
    const transcript = await svc.addBpFdeTranscript(req.params.sessionId, req.body.speaker, req.body.textContent);
    res.status(201).json({ transcript });
  } catch (e) { next(e); }
});

module.exports = router;
