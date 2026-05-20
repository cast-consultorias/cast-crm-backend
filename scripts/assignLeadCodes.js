// Asigna códigos CAST-YYYY-NNN a leads existentes sin código
// Uso: node scripts/assignLeadCodes.js
require('dotenv').config();

const svc = require('../services/sheets.service');

async function assignLeadCodes() {
  console.log('Leyendo leads existentes...\n');
  const leads = await svc.getAllLeads();

  const missing = leads.filter(l => !l.leadCode);
  const existing = leads.filter(l => l.leadCode);

  if (existing.length > 0) {
    console.log('Leads que ya tienen código:');
    existing.forEach(l => console.log(`  ✓ ${l.leadCode}  ${l.name}`));
    console.log('');
  }

  if (missing.length === 0) {
    console.log('✅ Todos los leads ya tienen código asignado.');
    return;
  }

  console.log(`Asignando códigos a ${missing.length} leads sin código:\n`);

  // Ordenar por fecha de creación para asignar códigos cronológicamente
  missing.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  for (const lead of missing) {
    try {
      const code = await svc.generateLeadCode();
      await svc.updateLead(lead.id, { leadCode: code }, 'system', 'Migración', 'Sistema');
      console.log(`  ✅ ${code}  →  ${lead.name}`);
    } catch (err) {
      console.error(`  ❌ ${lead.name}: ${err.message}`);
    }
  }

  console.log('\nListo.');
}

assignLeadCodes().catch(err => { console.error('Error fatal:', err.message); process.exit(1); });
