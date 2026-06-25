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

    await svc.addAttachment(req.params.leadId, {
      name: req.file.originalname, type: 'Documento',
      url: driveFile?.webViewLink || null, driveFileId: driveFile?.fileId || null,
      stageAt: lead.stage, size: sizeStr,
    }, req.user.userId);

    res.json({ success: true, driveFile });
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
