/**
 * Ejecutar UNA VEZ: node scripts/setupSheets.js
 * Crea todas las hojas con headers y agrega los 2 usuarios iniciales.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getSheets } = require('../config/google');
const { SPREADSHEET_ID, SHEETS, LEAD_HEADERS } = require('../config/sheets');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const ACTIVITY_HEADERS    = ['id','leadId','timestamp','userId','userName','userRole','action','detail','stageAt','ipAddress'];
const BLUEPRINT_HEADERS   = ['id','leadId','conductedBy','sessionDate','phase00Done','phase01Done','phase02Done','phase03Done','phase04Done','phase05Done','phase02Notes','phase04Heaven','phase04Hell','phase04Financial','phase05Insights','phase05FlowConfirmed','phase05TierConfirmed','phase05Payment50','q1','q2','q3','q4Sector','q4International','q5','q5Amount','q6','q7_rs','q8','q8Time','q9','q10_pp_base','q10_pp_calc','q11','q11Time','q12','q12_rt','q13','q14','q14_es','q15','q16','q17','q17Consultors','q18','q19Capital','q20External','q20Detail','q21Range','q21Tier','blockH','ivcCalculated','outputGenerated','outputApprovedBy','outputApprovedAt','outputNotes'];
const ATTACHMENTS_HEADERS = ['id','leadId','name','type','url','driveFileId','uploadedBy','uploadedAt','stageAt','description','size'];
const USERS_HEADERS       = ['id','email','passwordHash','name','role','isCEO','active','createdAt','lastLogin','color','initials'];
const SEGUIMIENTO_HEADERS = ['id','leadId','name','company','email','blueprintDate','ivcScore','tier','motivo','proximoContacto','responsable','estado','notas','createdAt','updatedAt'];
const CLOSED_LOST_HEADERS = ['id','leadId','name','company','email','sector','country','blueprintDate','ivcScore','razon','categoria','recontactar','observaciones','createdAt'];

async function run() {
  const sheets = await getSheets();

  const sheetConfigs = [
    { name: SHEETS.LEADS,       headers: LEAD_HEADERS },
    { name: SHEETS.ACTIVITY,    headers: ACTIVITY_HEADERS },
    { name: SHEETS.BLUEPRINT,   headers: BLUEPRINT_HEADERS },
    { name: SHEETS.ATTACHMENTS, headers: ATTACHMENTS_HEADERS },
    { name: SHEETS.USERS,       headers: USERS_HEADERS },
    { name: SHEETS.SEGUIMIENTO, headers: SEGUIMIENTO_HEADERS },
    { name: SHEETS.CLOSED_LOST, headers: CLOSED_LOST_HEADERS },
  ];

  // Get existing sheet names
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = meta.data.sheets.map(s => s.properties.title);

  for (const config of sheetConfigs) {
    if (!existing.includes(config.name)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: config.name } } }] },
      });
      console.log(`✅ Hoja creada: ${config.name}`);
    }
    // Write headers to row 1
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${config.name}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [config.headers] },
    });
    console.log(`✅ Headers escritos: ${config.name}`);
  }

  // Add initial users
  const usersSheet = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEETS.USERS}!B:B` });
  const existingEmails = (usersSheet.data.values || []).flat();

  const initialUsers = [
    { email:'carlos@castconsultorias.com', password:'cast2026', name:'Carlos Suárez Tous', role:'CEO & Fundador · PMP®', isCEO:true,  color:'#007AFF', initials:'CS' },
    { email:'equipo@castconsultorias.com', password:'cast2026', name:'Eusimary Contreras',  role:'Coordinadora · Auditora en Salud', isCEO:false, color:'#BF5AF2', initials:'EC' },
  ];

  for (const u of initialUsers) {
    if (existingEmails.includes(u.email)) { console.log(`⏭️  Usuario ya existe: ${u.email}`); continue; }
    const hash = await bcrypt.hash(u.password, 12);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEETS.USERS}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[uuidv4(), u.email, hash, u.name, u.role, u.isCEO?'TRUE':'FALSE', 'TRUE', new Date().toISOString(), '', u.color, u.initials]] },
    });
    console.log(`✅ Usuario creado: ${u.email}`);
  }

  console.log('\n🎉 Setup de Google Sheets completado.');
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
