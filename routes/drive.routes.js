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
    const file = await driveSvc.uploadFileToDrive(lead.driveFolderId, req.file.originalname, req.file.mimetype, req.file.buffer);
    await svc.addAttachment(req.params.leadId, { name:req.file.originalname, type:'document', url:file.webViewLink, driveFileId:file.fileId, stageAt:lead.stage, size:req.file.size }, req.user.userId);
    res.json({ file });
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
