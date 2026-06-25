const router  = require('express').Router();
const auth    = require('../middleware/auth');
const ceoOnly = require('../middleware/ceo');
const svc     = require('../services/supabase.service');

router.get('/stats', auth, async (req, res, next) => {
  try {
    const stats = await svc.getDashboardStats();
    res.json(stats);
  } catch (e) { next(e); }
});

router.get('/alerts', auth, async (req, res, next) => {
  try {
    const leads = await svc.getAllLeads();
    res.json({
      noReportIA:         leads.filter(l => ['01','02'].includes(l.stage) && !l.reportIA).map(l => ({ id:l.id, name:l.name, company:l.company, stage:l.stage })),
      noContacto:         leads.filter(l => l.stage === '03').map(l => ({ id:l.id, name:l.name })),
      sesionPendiente:    leads.filter(l => ['04','05'].includes(l.stage)).length,
      slaAtivos:          leads.filter(l => l.slaActive).map(l => ({ id:l.id, name:l.name, slaStartTime:l.slaStartTime })),
      propuestasActivas:  leads.filter(l => ['10','11','12','13'].includes(l.stage)).length,
    });
  } catch (e) { next(e); }
});

router.get('/recent', auth, async (req, res, next) => {
  try {
    const leads = await svc.getAllLeads();
    const recent = leads.sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 10);
    res.json({ leads: recent });
  } catch (e) { next(e); }
});

module.exports = router;
