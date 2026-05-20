// Crea carpetas Drive para leads que no tienen driveFolderId
// Uso: node scripts/repairDriveFolders.js
require('dotenv').config();

const svc      = require('../services/sheets.service');
const driveSvc = require('../services/drive.service');

async function repairDriveFolders() {
  console.log('Buscando leads sin carpeta Drive...\n');

  const leads = await svc.getAllLeads();
  const missing = leads.filter(l => !l.driveFolderId);

  if (missing.length === 0) {
    console.log('✅ Todos los leads ya tienen carpeta Drive.');
    return;
  }

  console.log(`Encontrados ${missing.length} leads sin carpeta Drive:\n`);
  for (const l of missing) {
    console.log(`  · ${l.name} (${l.id})`);
  }

  console.log('\nCreando carpetas...\n');

  for (const lead of missing) {
    try {
      const { folderId, webViewLink } = await driveSvc.createLeadFolder(lead);
      await svc.updateLead(lead.id, { driveFolderId: folderId }, 'repair', 'Script Reparación', 'Sistema');
      console.log(`✅ ${lead.name} → ${webViewLink}`);
    } catch (err) {
      console.error(`❌ ${lead.name}: ${err.message}`);
    }
  }

  console.log('\nListo.');
}

repairDriveFolders().catch(err => { console.error('Error fatal:', err.message); process.exit(1); });
