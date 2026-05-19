/**
 * Ejecutar UNA VEZ: node scripts/setupDrive.js
 * Crea la estructura de carpetas en Google Drive e imprime los IDs para el .env
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getDrive } = require('../config/google');

async function createFolder(drive, name, parentId) {
  const res = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
    fields: 'id,name,webViewLink',
  });
  return res.data;
}

async function run() {
  const drive = await getDrive();

  console.log('Creando estructura de carpetas en Google Drive...\n');

  const root     = await createFolder(drive, 'CAST CRM');
  const active   = await createFolder(drive, '01 · Leads Activos',      root.id);
  const clients  = await createFolder(drive, '02 · Clientes Cerrados',   root.id);
  const seguim   = await createFolder(drive, '03 · En Seguimiento',      root.id);
  const lost     = await createFolder(drive, '04 · Closed Lost',         root.id);

  console.log('✅ Estructura creada:\n');
  console.log('Copia estas líneas a tu archivo .env:\n');
  console.log(`DRIVE_ROOT_FOLDER_ID=${root.id}`);
  console.log(`DRIVE_LEADS_ACTIVE_FOLDER=${active.id}`);
  console.log(`DRIVE_CLIENTS_CLOSED_FOLDER=${clients.id}`);
  console.log(`DRIVE_SEGUIMIENTO_FOLDER=${seguim.id}`);
  console.log(`DRIVE_CLOSED_LOST_FOLDER=${lost.id}`);
  console.log(`\n🔗 Enlace a la carpeta raíz: ${root.webViewLink}`);
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
