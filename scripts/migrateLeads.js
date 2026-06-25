require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_LEADS    = process.env.SHEET_LEADS || 'Leads';
const PRIVATE_KEY    = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
  credentials: {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: PRIVATE_KEY,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Lead real de Eusimary Contreras (extraído de localStorage)
const REAL_LEAD = {
  id: '3e1c8e94-dfed-47ac-b505-d467a2f2c111',
  name: 'Eusimary Contreras',
  company: '—',
  email: 'eusimarycontreras@hotmail.com',
  phone: '3016254865',
  country: 'Barranquilla-Colombia',
  sector: 'Salud / Healthcare',
  score: 55,
  level: 'C',
  stage: '04',
  valueUSD: 500,
  probability: 30,
  painType: 'Otro',
  projectStage: 'En operación',
  source: 'WhatsApp',
  assignee: 'Carlos Suárez',
  flowType: '',
  tier: '',
  reportIA: false,
  blueprintDone: false,
  ivcRS: 0, ivcPP: 0, ivcRT: 0, ivcES: 0, ivcScore: '',
  slaActive: false, slaStartTime: '',
  notes: 'Descripción: Lograr pasar de una facturación de servicios de salud lenta a ser ágil, precisa y analítica para la toma de decisiones. | Objetivo: Otro | Rol: Otro (especificar)',
  createdAt: '2026-05-19',
  updatedAt: '2026-05-19T04:52:29.114Z',
  entryType: 'automatic',
  driveFolderId: '', loomUrl: '', deliverableUrl: '',
  nextAction: '', nextActionDate: '', nextActionAssignee: 'Carlos Suárez',
  closedLostReason: '', closedLostCategory: '', recontactDate: '',
  reportContent: '',
};

function leadToRow(l) {
  return [
    l.id, l.name, l.company, l.email, l.phone,
    l.country, l.sector, l.score, l.level, l.stage,
    l.valueUSD, l.probability, l.painType, l.projectStage,
    l.source, l.assignee, l.flowType||'', l.tier||'',
    l.reportIA?'TRUE':'FALSE', l.blueprintDone?'TRUE':'FALSE',
    l.ivcRS||0, l.ivcPP||0, l.ivcRT||0, l.ivcES||0,
    l.ivcScore||'', l.slaActive?'TRUE':'FALSE', l.slaStartTime||'',
    l.notes||'', l.createdAt, l.updatedAt, l.entryType||'automatic',
    l.driveFolderId||'', l.loomUrl||'', l.deliverableUrl||'',
    l.nextAction||'', l.nextActionDate||'', l.nextActionAssignee||'',
    l.closedLostReason||'', l.closedLostCategory||'', l.recontactDate||'',
    l.reportContent||'', l.leadCode||'',
  ];
}

async function run() {
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  // 1. Leer filas actuales para ver qué hay
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_LEADS}!A2:B50`,
  });
  const rows = res.data.values || [];
  console.log(`Filas actuales en el sheet (sin header): ${rows.length}`);
  rows.forEach((r, i) => console.log(`  Fila ${i+2}: ${r[0]} | ${r[1]}`));

  // 2. Borrar todas las filas de datos (A2:AN200)
  console.log('\nBorrando seed data...');
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_LEADS}!A2:AN200`,
  });
  console.log('✅ Seed data eliminado');

  // 3. Insertar el lead real
  console.log('\nInsertando lead real: Eusimary Contreras...');
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_LEADS}!A2`,
    valueInputOption: 'RAW',
    requestBody: { values: [leadToRow(REAL_LEAD)] },
  });
  console.log('✅ Lead real insertado correctamente');
  console.log('\n🎉 Migración completada. El CRM ahora mostrará solo leads reales.');
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
