const router  = require('express').Router();
const multer  = require('multer');
const auth    = require('../middleware/auth');
const svc     = require('../services/supabase.service');
const driveSvc= require('../services/drive.service');
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/lead/:leadId', auth, async (req, res, next) => {
  try {
    const lead = await svc.getLeadById(req.params.leadId);
    if (!lead?.driveFolderId) return res.json({ files: [] });
    const files = await driveSvc.getLeadFolderContents(lead.driveFolderId);
    res.json({ files });
  } catch (e) { next(e); }
});

router.post('/upload/:leadId', auth, upload.single('file'), async (req, res, next) => {
  try {
    const lead = await svc.getLeadById(req.params.leadId);
    if (!lead?.driveFolderId) return res.status(400).json({ error: 'Lead sin carpeta Drive' });
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

    // Subir a Drive — si falla, seguimos registrando en Supabase
    let driveFile = null;
    let driveError = null;
    try {
      driveFile = await driveSvc.uploadFileToDrive(lead.driveFolderId, req.file.originalname, req.file.mimetype, req.file.buffer);
    } catch (e) {
      driveError = e.message;
      console.warn(`[drive-upload] Drive falló para ${req.file.originalname}:`, e.message);
    }

    const sizeStr = req.file.size > 1024*1024
      ? `${(req.file.size / (1024*1024)).toFixed(1)} MB`
      : `${(req.file.size / 1024).toFixed(0)} KB`;

    const STAGE_LABELS = { '08': 'Propuesta Comercial', '13': 'Contrato Firmado', '14': 'Comprobante de Pago' };
    const STAGE_NEXT   = { '08': '09', '13': '14', '14': '15' };
    const attachType = STAGE_LABELS[lead.stage] || 'Documento';

    await svc.addAttachment(req.params.leadId, {
      name: req.file.originalname, type: attachType,
      url: driveFile?.webViewLink || null, driveFileId: driveFile?.fileId || null,
      stageAt: lead.stage, size: sizeStr,
    }, req.user.userId);

    // Auto-avance por carga de documento clave
    let movedToStage = null;
    const nextStage = STAGE_NEXT[lead.stage];
    if (nextStage) {
      try {
        const updates = { stage: nextStage, slaActive: false };
        if (nextStage === '09') updates.slaStartTime = new Date().toISOString(); // timer para 09→10 en 48h
        await svc.updateLead(req.params.leadId, updates, req.user.userId, req.user.name, req.user.role);
        await svc.addActivityLog(req.params.leadId, req.user.userId, req.user.name, req.user.role,
          `Auto-avance ${lead.stage}→${nextStage}`, `Documento "${req.file.originalname}" cargado en Soportes`, nextStage);
        movedToStage = nextStage;
        console.log(`[drive-upload] Lead ${req.params.leadId} auto-avanzado ${lead.stage}→${nextStage}`);
      } catch (e) {
        console.warn(`[drive-upload] Auto-avance ${lead.stage}→${nextStage} falló:`, e.message);
      }
    }

    res.json({ success: true, driveFile, movedToStage, driveError });
  } catch (e) { next(e); }
});

router.post('/move/:leadId', auth, async (req, res, next) => {
  try {
    const { destination } = req.body;
    const lead = await svc.getLeadById(req.params.leadId);
    if (!lead?.driveFolderId) return res.status(400).json({ error: 'Lead sin carpeta Drive' });
    await driveSvc.moveLeadFolder(lead.driveFolderId, destination);
    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
