const router = require('express').Router();
const auth   = require('../middleware/auth');
const svc    = require('../services/supabase.service');

// GET /api/boards/:leadId
router.get('/:leadId', auth, async (req, res, next) => {
  try {
    const board = await svc.getBoard(req.params.leadId);
    res.json({ board });
  } catch (e) { next(e); }
});

// PUT /api/boards/:leadId
router.put('/:leadId', auth, async (req, res, next) => {
  try {
    const board = await svc.upsertBoard(req.params.leadId, req.body);
    res.json({ board });
  } catch (e) { next(e); }
});

module.exports = router;
