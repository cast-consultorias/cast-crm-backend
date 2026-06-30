const { getDrive, getDriveImpersonated } = require('../config/google');
require('dotenv').config();

const ROOT    = process.env.DRIVE_ROOT_FOLDER_ID;
const ACTIVE  = process.env.DRIVE_LEADS_ACTIVE_FOLDER;
const CLIENTS = process.env.DRIVE_CLIENTS_CLOSED_FOLDER;
const SEGUIMIENTO = process.env.DRIVE_SEGUIMIENTO_FOLDER;
const LOST    = process.env.DRIVE_CLOSED_LOST_FOLDER;

async function createLeadFolder(lead) {
  const drive  = await getDrive();
  const name   = `[${String(lead.id).substring(0,8)}] · ${lead.name} · ${lead.company} · ${new Date().toISOString().split('T')[0]}`;
  const res    = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [ACTIVE] },
    fields: 'id,webViewLink',
  });
  const folderId = res.data.id;
  // Share folder with the workspace user so impersonated uploads work (service accounts have no quota)
  const WORKSPACE_USER = process.env.GMAIL_SENDER;
  if (WORKSPACE_USER) {
    try {
      await drive.permissions.create({
        fileId: folderId,
        requestBody: { role: 'writer', type: 'user', emailAddress: WORKSPACE_USER },
        sendNotificationEmail: false,
      });
    } catch (e) {
      console.warn('[drive] No se pudo compartir carpeta con', WORKSPACE_USER, ':', e.message);
    }
  }
  return { folderId, webViewLink: res.data.webViewLink };
}

async function moveLeadFolder(folderId, destination) {
  const drive = await getDrive();
  const destMap = { clients: CLIENTS, seguimiento: SEGUIMIENTO, 'closed-lost': LOST };
  const destId  = destMap[destination];
  if (!destId) throw new Error('Destino desconocido: ' + destination);

  const file = await drive.files.get({ fileId: folderId, fields: 'parents' });
  const prevParents = file.data.parents.join(',');
  await drive.files.update({ fileId: folderId, addParents: destId, removeParents: prevParents, fields: 'id,parents' });
}

async function uploadFileToDrive(folderId, fileName, mimeType, fileBuffer) {
  const { Readable } = require('stream');
  // Service accounts have no Drive storage quota — must use impersonation (carlos@)
  const drive = await getDriveImpersonated();
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: Readable.from(fileBuffer) },
    fields: 'id,webViewLink,name',
  });
  return { fileId: res.data.id, webViewLink: res.data.webViewLink, name: res.data.name };
}

async function getLeadFolderContents(folderId) {
  const drive = await getDrive();
  const res   = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,webViewLink,createdTime,size)',
    orderBy: 'createdTime desc',
  });
  return res.data.files || [];
}

async function ensureFolderStructure() {
  const folders = [
    { id: ROOT, name: 'CAST CRM Root' },
    { id: ACTIVE, name: '01 · Leads Activos' },
    { id: CLIENTS, name: '02 · Clientes Cerrados' },
    { id: SEGUIMIENTO, name: '03 · En Seguimiento' },
    { id: LOST, name: '04 · Closed Lost' },
  ];
  const drive = await getDrive();
  for (const f of folders) {
    if (!f.id) { console.warn(`⚠️  Missing Drive folder ID for "${f.name}" — check .env`); continue; }
    try { await drive.files.get({ fileId: f.id, fields: 'id' }); }
    catch { console.warn(`⚠️  Drive folder "${f.name}" (${f.id}) not accessible`); }
  }
}

module.exports = { createLeadFolder, moveLeadFolder, uploadFileToDrive, getLeadFolderContents, ensureFolderStructure };
