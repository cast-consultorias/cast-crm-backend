const router  = require('express').Router();
const multer  = require('multer');
const auth    = require('../middleware/auth');
const ceoOnly = require('../middleware/ceo');
const svc     = require('../services/sheets.service');
const driveSvc= require('../services/drive.service');
const { leadSchema, stageSchema, validate } = require('../utils/validators');
const { nowISO } = require('../utils/dateUtils');
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/leads
router.get('/', auth, async (req, res, next) => {
  try {
    let leads = await svc.getAllLeads();
    const { stage, level, assignee, search, sortBy = 'updatedAt', order = 'desc', limit = 100, offset = 0 } = req.query;

    if (stage)    leads = leads.filter(l => l.stage === stage);
    if (level)    leads = leads.filter(l => l.level === level);
    if (assignee) leads = leads.filter(l => l.assignee === assignee);
    if (search) {
      const q = search.toLowerCase();
      leads = leads.filter(l => [l.name, l.company, l.sector, l.country, l.email].some(f => f?.toLowerCase().includes(q)));
    }

    leads.sort((a, b) => {
      const av = a[sortBy] || 0, bv = b[sortBy] || 0;
      return order === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

    const total = leads.length;
    const page  = leads.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    res.json({ leads: page, total });
  } catch (e) { next(e); }
});

// GET /api/leads/:id
router.get('/:id', auth, async (req, res, next) => {
  try {
    const lead = await svc.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    const [activity, attachments] = await Promise.all([
      svc.getActivityByLeadId(req.params.id),
      svc.getAttachmentsByLeadId(req.params.id),
    ]);
    res.json({ lead: { ...lead, activityLog: activity, attachments } });
  } catch (e) { next(e); }
});

// POST /api/leads
router.post('/', auth, async (req, res, next) => {
  try {
    const { valid, error } = validate(leadSchema, req.body);
    if (!valid) return res.status(400).json({ error });

    const lead = await svc.createLead(req.body, req.user.userId, req.user.name, req.user.role);

    // Create Drive folder
    try {
      const { folderId } = await driveSvc.createLeadFolder(lead);
      await svc.updateLead(lead.id, { driveFolderId: folderId }, req.user.userId, req.user.name, req.user.role);
      lead.driveFolderId = folderId;
    } catch (e) { console.warn('Drive folder creation failed:', e.message); }

    res.status(201).json({ lead });
  } catch (e) { next(e); }
});

// PUT /api/leads/:id
router.put('/:id', auth, async (req, res, next) => {
  try {
    const updates = { ...req.body };
    delete updates.stage; // Stage changes via PATCH /stage
    const lead = await svc.updateLead(req.params.id, updates, req.user.userId, req.user.name, req.user.role);
    res.json({ lead });
  } catch (e) { next(e); }
});

// PATCH /api/leads/:id/stage
router.patch('/:id/stage', auth, async (req, res, next) => {
  try {
    const { valid, error } = validate(stageSchema, req.body);
    if (!valid) return res.status(400).json({ error });

    const { newStage, reason } = req.body;
    const lead = await svc.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    // CEO-only stages
    if (['14'].includes(newStage) && !req.user.isCEO) return res.status(403).json({ error: 'Solo el CEO puede marcar como Closed Won' });
    if (['18'].includes(newStage) && !req.user.isCEO) return res.status(403).json({ error: 'Solo el CEO puede marcar como Closed Lost' });

    const updated = await svc.updateLeadStage(req.params.id, newStage, req.user.userId, req.user.name, req.user.role, reason);

    // Move Drive folder on terminal stages
    if (lead.driveFolderId) {
      if (newStage === '14') driveSvc.moveLeadFolder(lead.driveFolderId, 'clients').catch(() => {});
      if (newStage === '18') {
        driveSvc.moveLeadFolder(lead.driveFolderId, 'closed-lost').catch(() => {});
        svc.addToClosedLost(lead, reason, '', false).catch(() => {});
      }
    }

    res.json({ lead: updated });
  } catch (e) { next(e); }
});

// DELETE /api/leads/:id — CEO only
router.delete('/:id', auth, ceoOnly, async (req, res, next) => {
  try {
    await svc.deleteLead(req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// GET /api/leads/:id/activity
router.get('/:id/activity', auth, async (req, res, next) => {
  try {
    const activity = await svc.getActivityByLeadId(req.params.id);
    res.json({ activity });
  } catch (e) { next(e); }
});

// POST /api/leads/:id/attachments (file upload)
router.post('/:id/attachments', auth, upload.single('file'), async (req, res, next) => {
  try {
    const lead = await svc.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    let url = '', driveFileId = '';
    if (req.file && lead.driveFolderId) {
      const uploaded = await driveSvc.uploadFileToDrive(lead.driveFolderId, req.file.originalname, req.file.mimetype, req.file.buffer);
      url = uploaded.webViewLink;
      driveFileId = uploaded.fileId;
    } else if (req.body.url) {
      url = req.body.url;
    }

    const attData = { name: req.file?.originalname || req.body.name || 'Archivo', type: req.body.type || 'document', url, driveFileId, stageAt: lead.stage, description: req.body.description || '', size: req.file?.size || 0 };
    await svc.addAttachment(req.params.id, attData, req.user.userId);
    res.status(201).json({ success: true });
  } catch (e) { next(e); }
});

// GET /api/leads/:id/attachments
router.get('/:id/attachments', auth, async (req, res, next) => {
  try {
    const attachments = await svc.getAttachmentsByLeadId(req.params.id);
    res.json({ attachments });
  } catch (e) { next(e); }
});

// GET /api/leads/:id/folder
router.get('/:id/folder', auth, async (req, res, next) => {
  try {
    const lead = await svc.getLeadById(req.params.id);
    if (!lead?.driveFolderId) return res.json({ files: [] });
    const files = await driveSvc.getLeadFolderContents(lead.driveFolderId);
    res.json({ files });
  } catch (e) { next(e); }
});

// POST /api/leads/sync-external — CEO only
// Importa leads nuevos desde los sheets externos de scoring
router.post('/sync-external', auth, ceoOnly, async (req, res, next) => {
  try {
    const { syncExternalLeads } = require('../services/externalLeads.service');
    const results = await syncExternalLeads();
    res.json({ success: true, ...results });
  } catch (e) { next(e); }
});

// POST /api/leads/:id/generate-report
router.post('/:id/generate-report', auth, async (req, res, next) => {
  try {
    const lead = await svc.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const { generateLeadReport } = require('../services/ai.service');
    const reportContent = await generateLeadReport(lead);

    await svc.updateLead(lead.id, { reportIA: true, reportContent, updatedAt: nowISO() },
      req.user.userId, req.user.name, req.user.role);

    if (lead.stage === '01' || lead.stage === '02') {
      await svc.updateLeadStage(lead.id, '03', req.user.userId, req.user.name, req.user.role,
        'Reporte IA generado');
    }

    await svc.addActivityLog(lead.id, req.user.userId, req.user.name, req.user.role,
      'Reporte IA generado', 'Análisis IA completado — 6 secciones', '03');

    const updated = await svc.getLeadById(lead.id);
    res.json({ success: true, lead: updated });
  } catch (e) { next(e); }
});

module.exports = router;
