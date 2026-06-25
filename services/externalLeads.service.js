const { getSheets } = require('../config/google');
const svc      = require('./supabase.service');
const driveSvc = require('./drive.service');
const { getLevel } = require('./ivc.service');

const SCORING_SHEET_ID = process.env.EXTERNAL_SCORING_SHEET_ID;
const FORMS_SHEET_ID   = process.env.EXTERNAL_FORMS_SHEET_ID;
const SCORING_GID      = parseInt(process.env.EXTERNAL_SCORING_GID || '0');
const FORMS_GID        = parseInt(process.env.EXTERNAL_FORMS_GID   || '0');

// ─── Sheet 1 — Scoring Dashboard ──────────────────────────────────────────
// A=0:Fecha  B=1:Grado  C=2:Score  D=3:Etiqueta  E=4:TiempoRespuesta
// F=5:Nombre  G=6:Email  H=7:WhatsApp  I=8:País  J=9:Perfil
// K=10:Urgencia  L=11:ProyectoDesafío  M=12:Estado

// ─── Sheet 2 — Google Form Responses ──────────────────────────────────────
// A=0:MarcaTemporal  B=1:EmailGoogle  C=2:Nombre  D=3:Email
// E=4:WhatsApp  F=5:PaísYCiudad  G=6:RolActual  H=7:Sector
// I=8:IdeaNegocio  J=9:EtapaProyecto  K=10:Descripción  L=11:Objetivo
// M=12:ExperienciaConsultoría  N=13:RangoInversión  O=14:Disposición
// P=15:CuándoAgendar  Q=16:Horarios  R=17:CómoNosEncontró  S=18:Autorización
// T=19..AC=28: Sub-scores  AD=29:ScoreTOTAL  AE=30:Clasificación
// AF=31:PerfilOrigen  AG=32:%Calificación  AH=33:EstadoCRM (columna que agregamos)

const INVESTMENT_MAP = [
  { pattern: /25\.?000\s*\+|25,?000\s*\+|\+25/i,  value: 50000 },
  { pattern: /10\.?000.{1,15}25/i,                 value: 25000 },
  { pattern: /5\.?000.{1,15}10/i,                  value: 10000 },
  { pattern: /2\.?000.{1,15}5/i,                   value: 5000  },
  { pattern: /500.{1,15}2\.?000/i,                 value: 2000  },
  { pattern: /menos.{1,10}500|<\s*500/i,           value: 500   },
];

function parseInvestment(str = '') {
  for (const { pattern, value } of INVESTMENT_MAP) {
    if (pattern.test(str)) return value;
  }
  return 0;
}

function cleanPhone(raw = '') {
  const cleaned = (raw || '').replace(/[^0-9+]/g, '');
  return cleaned.length >= 7 ? cleaned : '';
}

// "C - NURTURING" → "C"
function parseLevelFromClasificacion(str = '') {
  const match = (str || '').trim().toUpperCase().charAt(0);
  return ['A','B','C','D'].includes(match) ? match : null;
}

async function getTabName(spreadsheetId, gid) {
  const sheets = await getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  const tab = gid
    ? meta.data.sheets.find(s => s.properties.sheetId === gid)
    : meta.data.sheets[0];
  return tab?.properties.title || null;
}

async function readSheet(spreadsheetId, tabName, range) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tabName}!${range}` });
  return res.data.values || [];
}

async function setCellValue(spreadsheetId, tabName, row, col, value) {
  const sheets = await getSheets();
  const colLetter = String.fromCharCode(64 + col); // 1=A, 2=B, ...
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!${colLetter}${row}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[value]] },
  });
}

async function syncExternalLeads() {
  if (!SCORING_SHEET_ID) throw new Error('EXTERNAL_SCORING_SHEET_ID no configurado en .env');

  const results = { imported: 0, enriched: 0, skipped: 0, duplicate: 0, errors: [] };

  // ── 1. Leer Sheet 2 (formularios) ──────────────────────────────────────
  let formsRows = [];
  let formsTab  = null;
  const formsLookup = {}; // email → row

  if (FORMS_SHEET_ID) {
    try {
      formsTab = await getTabName(FORMS_SHEET_ID, FORMS_GID);
      if (formsTab) {
        formsRows = await readSheet(FORMS_SHEET_ID, formsTab, 'A:AH');
        for (let i = 1; i < formsRows.length; i++) {
          const r = formsRows[i];
          const email = (r[3] || r[1] || '').toLowerCase().trim();
          if (email && !formsLookup[email]) formsLookup[email] = { row: r, sheetRow: i + 1 };
        }
      }
    } catch (e) {
      results.errors.push({ source: 'forms_sheet', error: e.message });
    }
  }

  // ── 2. Obtener leads existentes en CRM ─────────────────────────────────
  const existingLeads  = await svc.getAllLeads();
  const existingByEmail = new Map(
    existingLeads.map(l => [(l.email || '').toLowerCase().trim(), l])
  );

  // ── 3. Enriquecer leads ya importados con datos del Sheet 2 ────────────
  for (const [email, formEntry] of Object.entries(formsLookup)) {
    const existing = existingByEmail.get(email);
    if (!existing) continue;

    const f = formEntry.row;
    const updates = {};

    const newSector = (f[7] || '').trim();
    if (newSector && newSector.length > 2 && (existing.sector === 'Otro' || !existing.sector))
      updates.sector = newSector.substring(0, 60);

    const newSource = (f[17] || '').trim();
    if (newSource && existing.source === 'Google Forms')
      updates.source = newSource;

    const newValue = parseInvestment(f[13] || '');
    if (newValue > 0 && !existing.valueUSD)
      updates.valueUSD = newValue;

    const newStage = (f[9] || '').trim();
    if (newStage && !existing.projectStage)
      updates.projectStage = newStage;

    if (Object.keys(updates).length > 0) {
      try {
        await svc.updateLead(existing.id, updates, 'sync', 'Sync Externo', 'Sistema');
        results.enriched++;
        existingByEmail.set(email, { ...existing, ...updates });
      } catch (e) {
        results.errors.push({ email, action: 'enrich', error: e.message });
      }
    }
  }

  // ── 4. Procesar Sheet 1 (scoring dashboard) — importar nuevos ──────────
  const scoringTab = await getTabName(SCORING_SHEET_ID, SCORING_GID);
  if (!scoringTab) throw new Error('No se encontró la pestaña del sheet de scoring');

  const scoringRows = await readSheet(SCORING_SHEET_ID, scoringTab, 'A:R');

  for (let i = 1; i < scoringRows.length; i++) {
    const row   = scoringRows[i];
    if (!row || row.length < 6) continue;

    const estado = (row[12] || '').trim().toLowerCase();
    const nombre = (row[5] || '').trim();
    const email  = (row[6] || '').toLowerCase().trim();

    if (estado !== 'nuevo')  { results.skipped++; continue; }
    if (!nombre || !email)   { results.skipped++; continue; }

    if (existingByEmail.has(email)) {
      await setCellValue(SCORING_SHEET_ID, scoringTab, i + 1, 13, 'En CRM').catch(() => {});
      results.duplicate++;
      continue;
    }

    try {
      const score = parseInt(row[2]) || 50;
      const grado = (row[1] || '').trim().toUpperCase().charAt(0);
      const f     = formsLookup[email]?.row || [];

      const rawSector = (f[7] || row[9] || 'Otro').trim();
      const sector    = rawSector.length > 2 ? rawSector.substring(0, 60) : 'Otro';
      const noteParts = [];
      if (row[9])  noteParts.push(`Perfil: ${row[9]}`);
      if (row[10]) noteParts.push(`Urgencia: ${row[10]}`);
      if (row[11]) noteParts.push(`Proyecto: ${row[11]}`);
      if (f[10])   noteParts.push(`Descripción: ${f[10]}`);
      if (row[3])  noteParts.push(`Etiqueta: ${row[3]}`);

      const levelFinal = ['A','B','C','D'].includes(grado) ? grado : getLevel(score);
      const newLead = await svc.createLead({
        name: nombre, company: '—', email,
        phone:        cleanPhone(row[7] || ''),
        country:      (row[8] || '🇨🇴 Colombia').trim(),
        sector,
        score,
        level:        levelFinal,
        stage:        '01',
        valueUSD:     parseInvestment(f[13] || ''),
        probability:  grado==='A'?80 : grado==='B'?60 : grado==='C'?30 : 10,
        painType:     (row[11] || '').substring(0, 200),
        projectStage: (f[9] || '').trim(),
        source:       (f[17] || 'Google Forms').trim(),
        assignee:     'Carlos Suárez',
        notes:        noteParts.join(' | '),
        entryType:    'automatic',
        flowType:     ['A','B'].includes(levelFinal) ? 'Flujo 2' : '',
      }, 'sync', 'Sync Externo', 'Sistema');

      // Crear carpeta en Drive para el nuevo lead
      try {
        const { folderId } = await driveSvc.createLeadFolder(newLead);
        await svc.updateLead(newLead.id, { driveFolderId: folderId }, 'sync', 'Sync Externo', 'Sistema');
      } catch (driveErr) {
        console.warn(`Drive folder creation failed for ${nombre}:`, driveErr.message);
        results.errors.push({ row: i + 1, email, name: nombre, action: 'drive_folder', error: driveErr.message });
      }

      await setCellValue(SCORING_SHEET_ID, scoringTab, i + 1, 13, 'En CRM');
      existingByEmail.set(email, { email });
      results.imported++;
    } catch (err) {
      results.errors.push({ row: i + 1, email, error: err.message });
    }
  }

  // ── 5. Importar leads de Sheet 2 que NO están en Sheet 1 ───────────────
  if (formsTab && formsRows.length > 1) {
    for (let i = 1; i < formsRows.length; i++) {
      const r      = formsRows[i];
      const nombre = (r[2] || '').trim();
      const email  = (r[3] || r[1] || '').toLowerCase().trim();
      const estadoCRM = (r[33] || '').trim().toLowerCase(); // col AH

      if (!nombre || !email)               continue;
      if (estadoCRM === 'en crm')          continue;
      if (existingByEmail.has(email))      {
        await setCellValue(FORMS_SHEET_ID, formsTab, i + 1, 34, 'En CRM').catch(() => {});
        continue;
      }

      const score = parseInt(r[29]) || 0;
      if (score === 0 && !nombre)          continue; // fila vacía / plantilla

      const clasificacion = r[30] || '';
      const level = parseLevelFromClasificacion(clasificacion) || getLevel(score);
      if (level === 'D') { results.skipped++; continue; } // No importar D

      try {
        const noteParts = [];
        if (r[10]) noteParts.push(`Descripción: ${r[10]}`);
        if (r[11]) noteParts.push(`Objetivo: ${r[11]}`);
        if (r[6])  noteParts.push(`Rol: ${r[6]}`);

        const newLead = await svc.createLead({
          name: nombre, company: '—', email,
          phone:        cleanPhone(r[4] || ''),
          country:      (r[5] || '🇨🇴 Colombia').trim() || '🇨🇴 Colombia',
          sector:       (r[7] || 'Otro').trim().substring(0, 60),
          score,
          level,
          stage:        '01',
          valueUSD:     parseInvestment(r[13] || ''),
          probability:  level==='A'?80 : level==='B'?60 : 30,
          painType:     (r[11] || '').substring(0, 200),
          projectStage: (r[9] || '').trim(),
          source:       (r[17] || 'Google Forms').trim(),
          assignee:     'Carlos Suárez',
          notes:        noteParts.join(' | '),
          entryType:    'automatic',
          flowType:     ['A','B'].includes(level) ? 'Flujo 2' : '',
        }, 'sync', 'Sync Externo', 'Sistema');

        // Crear carpeta en Drive para el nuevo lead
        try {
          const { folderId } = await driveSvc.createLeadFolder(newLead);
          await svc.updateLead(newLead.id, { driveFolderId: folderId }, 'sync', 'Sync Externo', 'Sistema');
        } catch (driveErr) {
          console.warn(`Drive folder creation failed for ${nombre}:`, driveErr.message);
          results.errors.push({ row: i + 1, email, name: nombre, source: 'forms', action: 'drive_folder', error: driveErr.message });
        }

        await setCellValue(FORMS_SHEET_ID, formsTab, i + 1, 34, 'En CRM');
        existingByEmail.set(email, { email });
        results.imported++;
      } catch (err) {
        results.errors.push({ row: i + 1, email, source: 'forms', error: err.message });
      }
    }
  }

  return results;
}

// ─── RECOVERY: detecta leads "En CRM" en scoring sheet que no llegaron a Supabase ──
// Ocurre cuando el backend estaba caído en el momento del ingreso del lead.
async function recoverMissingLeads() {
  if (!SCORING_SHEET_ID) return { recovered: 0, errors: [] };

  const results = { recovered: 0, errors: [] };

  const scoringTab  = await getTabName(SCORING_SHEET_ID, SCORING_GID);
  if (!scoringTab) return results;

  const scoringRows = await readSheet(SCORING_SHEET_ID, scoringTab, 'A:R');

  // Emails actuales en Supabase
  const existingLeads  = await svc.getAllLeads();
  const existingEmails = new Set(existingLeads.map(l => (l.email || '').toLowerCase().trim()));

  // Leer Sheet 2 (formularios) para enriquecer datos si existen
  let formsLookup = {};
  if (FORMS_SHEET_ID) {
    try {
      const formsTab = await getTabName(FORMS_SHEET_ID, FORMS_GID);
      if (formsTab) {
        const formsRows = await readSheet(FORMS_SHEET_ID, formsTab, 'A:AH');
        for (let i = 1; i < formsRows.length; i++) {
          const r = formsRows[i];
          const email = (r[3] || r[1] || '').toLowerCase().trim();
          if (email && !formsLookup[email]) formsLookup[email] = r;
        }
      }
    } catch (_) {}
  }

  for (let i = 1; i < scoringRows.length; i++) {
    const row    = scoringRows[i];
    if (!row || row.length < 6) continue;

    const estado = (row[12] || '').trim().toLowerCase();
    const nombre = (row[5] || '').trim();
    const email  = (row[6] || '').toLowerCase().trim();

    // Solo filas marcadas "en crm" que no existen en Supabase
    if (estado !== 'en crm') continue;
    if (!nombre || !email)   continue;
    if (existingEmails.has(email)) continue;

    try {
      const score  = parseInt(row[2]) || 50;
      const grado  = (row[1] || '').trim().toUpperCase().charAt(0);
      const f      = formsLookup[email] || [];

      const noteParts = [];
      if (row[9])  noteParts.push(`Perfil: ${row[9]}`);
      if (row[10]) noteParts.push(`Urgencia: ${row[10]}`);
      if (row[11]) noteParts.push(`Proyecto: ${row[11]}`);
      if (f[10])   noteParts.push(`Descripción: ${f[10]}`);

      const levelFinal = ['A','B','C','D'].includes(grado) ? grado : getLevel(score);
      const newLead = await svc.createLead({
        name:         nombre,
        company:      '—',
        email,
        phone:        cleanPhone(row[7] || ''),
        country:      (row[8] || '🇨🇴 Colombia').trim(),
        sector:       ((f[7] || row[9] || 'Otro').trim()).substring(0, 60),
        score,
        level:        levelFinal,
        stage:        '01',
        valueUSD:     parseInvestment(f[13] || ''),
        probability:  grado==='A'?80 : grado==='B'?60 : grado==='C'?30 : 10,
        painType:     (row[11] || '').substring(0, 200),
        projectStage: (f[9] || '').trim(),
        source:       (f[17] || 'Landing CAST').trim(),
        assignee:     'carlos@castconsultorias.com',
        notes:        noteParts.join(' | '),
        entryType:    'automatic',
        flowType:     ['A','B'].includes(levelFinal) ? 'Flujo 2' : '',
      }, 'recovery', 'Sistema (recuperación)', 'Sistema');

      // Crear carpeta en Drive
      try {
        const { folderId } = await driveSvc.createLeadFolder(newLead);
        await svc.updateLead(newLead.id, { driveFolderId: folderId }, 'recovery', 'Sistema (recuperación)', 'Sistema');
      } catch (_) {}

      existingEmails.add(email);
      results.recovered++;
      console.log(`[recovery] Lead recuperado: ${nombre} <${email}> — ${newLead.leadCode}`);
    } catch (err) {
      results.errors.push({ row: i + 1, name: nombre, email, error: err.message });
      console.error(`[recovery] Error recuperando ${nombre}:`, err.message);
    }
  }

  if (results.recovered > 0) {
    console.log(`[recovery] ✅ ${results.recovered} lead(s) recuperado(s) del scoring sheet`);
  }

  return results;
}

module.exports = { syncExternalLeads, recoverMissingLeads };
