const router  = require('express').Router();
const multer  = require('multer');
const auth    = require('../middleware/auth');
const ceoOnly = require('../middleware/ceo');
const svc     = require('../services/supabase.service');
const driveSvc= require('../services/drive.service');
const pdfSvc  = require('../services/pdf.service');
const gmailSvc= require('../services/gmail.service');
const { leadSchema, stageSchema, validate } = require('../utils/validators');
const { nowISO } = require('../utils/dateUtils');
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const { bookingEmailSentLeads } = require('../utils/emailDedup');

// GET /api/leads/debug/drive-auth — diagnóstico temporal de impersonación
router.get('/debug/drive-auth', auth, async (req, res) => {
  const { JWT } = require('google-auth-library');
  const { google } = require('googleapis');
  const email   = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const subject = process.env.GMAIL_SENDER;
  const key     = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  try {
    const jwt = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/drive'], subject });
    const creds = await jwt.authorize();
    const drive = google.drive({ version: 'v3', auth: jwt });
    const list  = await drive.files.list({ pageSize: 1, fields: 'files(id,name,owners)' });
    const owner = list.data.files[0]?.owners?.[0]?.emailAddress || 'unknown';
    res.json({ ok: true, impersonating: subject, serviceAccount: email, firstFileOwner: owner, hasToken: !!creds.access_token });
  } catch (e) {
    res.json({ ok: false, error: e.message, serviceAccount: email, subject });
  }
});

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

    // When a lead leaves stage 04, reset the dedup guard so re-entering 04 re-sends the email.
    if (lead.stage === '04' && newStage !== '04') {
      bookingEmailSentLeads.delete(req.params.id);
    }

    // Auto-send booking invitation email when moved to stage 04 (only if not already there)
    // bookingEmailSentLeads guards against race conditions where two simultaneous PATCH
    // requests both see lead.stage !== '04' before Sheets commits the first update.
    if (newStage === '04' && lead.stage !== '04') {
      const emailTarget = updated.email || lead.email;
      if (!emailTarget) {
        console.warn(`[email] Booking invitation SKIPPED for lead ${req.params.id} — no email address in Sheets`);
        await svc.addActivityLog(updated.id, req.user.userId, req.user.name, req.user.role,
          'Sin email', 'Email 00: No se envió la invitación — el lead no tiene email guardado en Sheets', '04').catch(() => {});
      } else if (!bookingEmailSentLeads.has(req.params.id)) {
        bookingEmailSentLeads.add(req.params.id);
        const leadToEmail = { ...updated, email: emailTarget };
        try {
          const msgId = await gmailSvc.sendBookingInvitation(leadToEmail);
          console.log(`[email] Booking invitation sent OK to ${emailTarget} — msgId: ${msgId}`);
          await svc.addActivityLog(updated.id, req.user.userId, req.user.name, req.user.role,
            'Email enviado', 'Email 00: Invitación a agendar Blueprint Session™ — enviado automáticamente', '04');
        } catch (emailErr) {
          bookingEmailSentLeads.delete(req.params.id); // allow retry if send failed
          console.error(`[email] Booking invitation FAILED to ${emailTarget}:`, emailErr.message);
          await svc.addActivityLog(updated.id, req.user.userId, req.user.name, req.user.role,
            'Error de email', `Email 00: Falló el envío — ${emailErr.message}`, '04').catch(() => {});
        }
      }
    }

    // Move Drive folder on terminal stages
    if (lead.driveFolderId) {
      if (newStage === '14') driveSvc.moveLeadFolder(lead.driveFolderId, 'clients').catch(() => {});
      if (newStage === '18') {
        driveSvc.moveLeadFolder(lead.driveFolderId, 'closed-lost').catch(() => {});
        svc.addToClosedLost(lead, reason, '', false).catch(() => {});
      }
    }

    // Auto-trigger AI analysis when moved to stage 02 (skip if report already exists)
    if (newStage === '02' && !lead.reportIA) {
      try {
        const { generateLeadReport } = require('../services/ai.service');
        const reportContent = await generateLeadReport(updated);
        await svc.updateLead(updated.id, { reportIA: true, reportContent, updatedAt: nowISO() },
          req.user.userId, req.user.name, req.user.role);
        await svc.updateLeadStage(updated.id, '03', req.user.userId, req.user.name, req.user.role,
          'Reporte IA generado automáticamente');
        await svc.addActivityLog(updated.id, req.user.userId, req.user.name, req.user.role,
          'Reporte IA generado', 'Análisis IA completado automáticamente al mover a Etapa 02', '03');
        const finalLead = await svc.getLeadById(updated.id);
        return res.json({ lead: finalLead });
      } catch (aiErr) {
        console.warn('Auto AI report failed:', aiErr.message);
        // Fall through — return lead at stage 02 so the user can retry manually
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

// POST /api/leads/:id/export-pdf/report — genera PDF del Reporte IA y lo descarga
router.post('/:id/export-pdf/report', auth, async (req, res, next) => {
  try {
    const lead = await svc.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    if (!lead.reportContent) return res.status(400).json({ error: 'El lead no tiene Reporte IA generado' });
    const pdfBuffer = await pdfSvc.generateReportPDF(lead);
    const fileName = `Reporte_IA_${lead.name.replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (e) { next(e); }
});

// POST /api/leads/:id/export-pdf/ivc — genera PDF de la Evaluación IVC y lo descarga
router.post('/:id/export-pdf/ivc', auth, async (req, res, next) => {
  try {
    const lead = await svc.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    if (!lead.blueprintSession) return res.status(400).json({ error: 'El lead no tiene Blueprint Session completada' });
    const pdfBuffer = await pdfSvc.generateIVCPDF(lead);
    const fileName = `Evaluacion_IVC_${lead.name.replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (e) { next(e); }
});

// POST /api/leads/:id/create-drive-folder — crea carpeta Drive retroactivamente
router.post('/:id/create-drive-folder', auth, async (req, res, next) => {
  try {
    const lead = await svc.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    if (lead.driveFolderId) return res.json({ alreadyExists: true, folderId: lead.driveFolderId });

    const { folderId, webViewLink } = await driveSvc.createLeadFolder(lead);
    await svc.updateLead(lead.id, { driveFolderId: folderId }, req.user.userId, req.user.name, req.user.role);
    res.json({ success: true, folderId, webViewLink });
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
