// Blueprints FDE+PMP™ — dominio distinto de /api/blueprint (Blueprint Session™ / IVC).
// No fusionar ni reutilizar rutas/tablas de ese módulo (ver docs/cast-strategy).
const router  = require('express').Router();
const auth    = require('../middleware/auth');
const svc     = require('../services/supabase.service');
const { structureBlueprintAnswer, estimateBlueprintFindingScores } = require('../services/ai.service');
const scoring = require('../services/blueprintScoring.service');

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

// POST /api/blueprints-fde/:sessionId/ai/structure — estructura una respuesta cruda con Claude.
// NUNCA escribe en blueprint_answers directamente — solo deja la propuesta en
// blueprint_ai_suggestions (§10.1: "AI puede sugerir. El FDE confirma.").
router.post('/:sessionId/ai/structure', auth, async (req, res, next) => {
  try {
    const { questionCode, rawText, questionSetVersion } = req.body;
    if (!questionCode || !rawText?.trim()) return res.status(400).json({ error: 'questionCode y rawText son requeridos' });

    const bank = await svc.getBpFdeQuestionBank(questionSetVersion || 1);
    const question = bank.questions.find(q => q.code === questionCode);
    if (!question) return res.status(404).json({ error: 'Pregunta no encontrada en el banco' });

    const result = await structureBlueprintAnswer(question.prompt, rawText);
    const suggestion = await svc.addBpFdeAiSuggestion(req.params.sessionId, 'structuring', {
      questionCode, rawText, ...result,
    });
    res.status(201).json({ suggestion });
  } catch (e) { next(e); }
});

// POST /api/blueprints-fde/:sessionId/ai/suggestions/:suggestionId/resolve — el FDE acepta/edita o rechaza
router.post('/:sessionId/ai/suggestions/:suggestionId/resolve', auth, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['ACCEPTED', 'REJECTED'].includes(status)) return res.status(400).json({ error: "status debe ser ACCEPTED o REJECTED" });
    const suggestion = await svc.resolveBpFdeAiSuggestion(req.params.suggestionId, status, req.user.userId, req.user.role);
    res.json({ suggestion });
  } catch (e) { next(e); }
});

// ─── Fase 8 — Hallazgos y Scoring ─────────────────────────────────────────────

// POST /api/blueprints-fde/:sessionId/findings — crear un hallazgo
router.post('/:sessionId/findings', auth, async (req, res, next) => {
  try {
    const { category, title, description, processRef, evidenceAnswerIds } = req.body;
    if (!category || !title?.trim()) return res.status(400).json({ error: 'category y title son requeridos' });
    const finding = await svc.createBpFdeFinding(req.params.sessionId, { category, title, description, processRef, evidenceAnswerIds }, req.user.userId, req.user.role);
    res.status(201).json({ finding });
  } catch (e) { next(e); }
});

// GET /api/blueprints-fde/:sessionId/findings — listar hallazgos (con su score si existe)
router.get('/:sessionId/findings', auth, async (req, res, next) => {
  try {
    const findings = await svc.getBpFdeFindings(req.params.sessionId);
    res.json({ findings });
  } catch (e) { next(e); }
});

// POST /api/blueprints-fde/:sessionId/findings/:findingId/ai-estimate — Claude estima
// las variables de entrada de los 5 scores. Nunca guarda scores — solo devuelve la
// estimación para que el FDE la revise/ajuste (§10.1, mismo principio de Fase 7).
router.post('/:sessionId/findings/:findingId/ai-estimate', auth, async (req, res, next) => {
  try {
    const finding = await svc.getBpFdeFindingById(req.params.findingId);
    if (!finding) return res.status(404).json({ error: 'Hallazgo no encontrado' });

    let evidenceText = '';
    if (finding.evidenceAnswerIds?.length) {
      const answers = await svc.getBpFdeAnswers(req.params.sessionId);
      evidenceText = answers.filter(a => finding.evidenceAnswerIds.includes(a.id))
        .map(a => `- ${a.questionCode}: ${a.answerText}`).join('\n');
    }

    const estimate = await estimateBlueprintFindingScores(finding, evidenceText);
    const suggestion = await svc.addBpFdeAiSuggestion(req.params.sessionId, 'scoring', { findingId: finding.id, ...estimate });
    res.status(201).json({ suggestion });
  } catch (e) { next(e); }
});

// POST /api/blueprints-fde/:sessionId/findings/:findingId/scores — el FDE confirma
// (con o sin ajustes) los valores y aquí SÍ se calculan y guardan los 5 scores.
router.post('/:sessionId/findings/:findingId/scores', auth, async (req, res, next) => {
  try {
    const { cos, automationPotential, aiOpportunity, castVoiceIndex, pmOpportunity, suggestionId } = req.body;
    const computed = scoring.calcAllScores({ cos, automationPotential, aiOpportunity, castVoiceIndex, pmOpportunity });
    const score = await svc.upsertBpFdeScore(
      req.params.sessionId, req.params.findingId, computed,
      { cos, automationPotential, aiOpportunity, castVoiceIndex, pmOpportunity },
      req.user.userId, req.user.role
    );
    if (suggestionId) await svc.resolveBpFdeAiSuggestion(suggestionId, 'ACCEPTED', req.user.userId, req.user.role).catch(() => {});
    res.json({ score, levels: { cos: computed.cos.level, automationPotential: computed.automationPotential.level, aiOpportunity: computed.aiOpportunity.level, castVoiceIndex: computed.castVoiceIndex.level } });
  } catch (e) { next(e); }
});

module.exports = router;
