const router  = require('express').Router();
const auth    = require('../middleware/auth');
const ceoOnly = require('../middleware/ceo');
const svc     = require('../services/sheets.service');
const { calculateIVC, generateOutputEvaluation } = require('../services/ivc.service');
const { sendBuildingDeliverable } = require('../services/gmail.service');
const { VELOCITY_MAP, INVOLVEMENT_MAP } = require('../config/constants');
const { nowISO, addDays } = require('../utils/dateUtils');

// GET /api/blueprint/:leadId
router.get('/:leadId', auth, async (req, res, next) => {
  try {
    const bp = await svc.getBlueprintByLeadId(req.params.leadId);
    res.json({ blueprintSession: bp });
  } catch (e) { next(e); }
});

// POST /api/blueprint/:leadId
router.post('/:leadId', auth, async (req, res, next) => {
  try {
    const lead = await svc.getLeadById(req.params.leadId);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    const bp = await svc.createBlueprint(req.params.leadId, req.user.userId);
    res.status(201).json({ blueprintSession: bp });
  } catch (e) { next(e); }
});

// PUT /api/blueprint/:leadId
router.put('/:leadId', auth, async (req, res, next) => {
  try {
    const updates = { ...req.body };

    // Recalculate IVC if relevant fields changed
    if (updates.q7 !== undefined || updates.q10 !== undefined || updates.q12 !== undefined || updates.q14 !== undefined) {
      const bp = await svc.getBlueprintByLeadId(req.params.leadId) || {};
      const rs   = updates.q7  ?? bp.q7  ?? 0;
      const pp   = updates.q10 ?? bp.q10 ?? 0;
      const q12  = updates.q12 ?? bp.q12 ?? '';
      const q14  = updates.q14 ?? bp.q14 ?? '';
      const ivcResult = calculateIVC(rs, pp, q12, q14);
      if (ivcResult) {
        updates.ivcCalculated = ivcResult.ivcScore;
        updates.q10Calc       = pp / 10;
        updates.q12Rt         = ivcResult.rt;
        updates.q14Es         = ivcResult.es;
        // Sync to lead
        await svc.updateLead(req.params.leadId, { ivcRS:rs, ivcPP:pp/10, ivcRT:ivcResult.rt, ivcES:ivcResult.es, ivcScore:ivcResult.ivcScore }, req.user.userId, req.user.name, req.user.role);
      }
    }

    if (updates.q21Range !== undefined) {
      const tiers = { tier_0:null, tier_1:'Esencial', tier_2:'Pro', tier_3:'Premium' };
      updates.q21Tier = tiers[updates.q21Range] || null;
    }

    const bp = await svc.updateBlueprint(req.params.leadId, updates, req.user.userId);
    res.json({ blueprintSession: bp, ivcScore: updates.ivcCalculated });
  } catch (e) { next(e); }
});

// POST /api/blueprint/:leadId/generate-output
router.post('/:leadId/generate-output', auth, async (req, res, next) => {
  try {
    const [lead, bp] = await Promise.all([
      svc.getLeadById(req.params.leadId),
      svc.getBlueprintByLeadId(req.params.leadId),
    ]);
    if (!lead || !bp) return res.status(404).json({ error: 'Lead o sesión no encontrada' });

    const output = generateOutputEvaluation(lead, bp);
    await svc.updateBlueprint(req.params.leadId, { outputGenerated: true }, req.user.userId);
    await svc.addActivityLog(req.params.leadId, req.user.userId, req.user.name, req.user.role, 'Output de evaluación generado', '', lead.stage);

    res.json({ output });
  } catch (e) { next(e); }
});

// POST /api/blueprint/:leadId/approve — CEO only
router.post('/:leadId/approve', auth, ceoOnly, async (req, res, next) => {
  try {
    const bp = await svc.getBlueprintByLeadId(req.params.leadId);
    if (!bp) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (!bp.outputGenerated) return res.status(400).json({ error: 'Output no generado aún' });

    await svc.approveBlueprint(req.params.leadId, req.user.userId, req.user.name);

    // Send email 2 (building deliverable, delivery in 48h)
    let emailSent = false;
    try {
      const lead = await svc.getLeadById(req.params.leadId);
      const deliveryDate = addDays(2).split('T')[0];
      await sendBuildingDeliverable(lead, deliveryDate);
      emailSent = true;
    } catch (e) { console.warn('Email 2 failed:', e.message); }

    res.json({ success: true, emailSent });
  } catch (e) { next(e); }
});

module.exports = router;
