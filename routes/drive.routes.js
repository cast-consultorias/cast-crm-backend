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
    try {
      driveFile = await driveSvc.uploadFileToDrive(lead.driveFolderId, req.file.originalname, req.file.mimetype, req.file.buffer);
    } catch (e) {
      console.warn(`[drive-upload] Drive falló para ${req.file.originalname}:`, e.message);
    }

    const sizeStr = req.file.size > 1024*1024
      ? `${(req.file.size / (1024*1024)).toFixed(1)} MB`
      : `${(req.file.size / 1024).toFixed(0)} KB`;

    const attachType = lead.stage === '08' ? 'Propuesta Comercial' : 'Documento';
    await svc.addAttachment(req.params.leadId, {
      name: req.file.originalname, type: attachType,
      url: driveFile?.webViewLink || null, driveFileId: driveFile?.fileId || null,
      stageAt: lead.stage, size: sizeStr,
    }, req.user.userId);

    // Auto-avance: cuando se sube el entregable en stage 08 → mover a stage 09
    let movedToStage = null;
    if (lead.stage === '08') {
      try {
        await svc.updateLead(req.params.leadId, { stage: '09', slaActive: false }, req.user.userId, req.user.name, req.user.role);
        movedToStage = '09';
        console.log(`[drive-upload] Lead ${req.params.leadId} auto-avanzado 08→09 (Entregable Enviado)`);
      } catch (e) {
        console.warn(`[drive-upload] Auto-avance 08→09 falló:`, e.message);
      }
    }

    res.json({ success: true, driveFile, movedToStage });
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
