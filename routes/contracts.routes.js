const router = require('express').Router();
const auth   = require('../middleware/auth');
const svc    = require('../services/supabase.service');

// GET /api/contracts — todos (para Dashboard KPI)
router.get('/', auth, async (req, res, next) => {
  try {
    const contracts = await svc.getAllContracts();
    res.json({ contracts });
  } catch (e) { next(e); }
});

// GET /api/contracts/:leadId
router.get('/:leadId', auth, async (req, res, next) => {
  try {
    const contract = await svc.getContract(req.params.leadId);
    res.json({ contract });
  } catch (e) { next(e); }
});

// PUT /api/contracts/:leadId
router.put('/:leadId', auth, async (req, res, next) => {
  try {
    const contract = await svc.upsertContract(req.params.leadId, req.body);
    res.json({ contract });
  } catch (e) { next(e); }
});

module.exports = router;
