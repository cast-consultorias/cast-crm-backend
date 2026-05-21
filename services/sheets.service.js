const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { getSheets } = require('../config/google');
const { SPREADSHEET_ID, SHEETS } = require('../config/sheets');
const { rowToLead, leadToRow, rowToActivity, rowToUser } = require('../utils/formatters');
const { nowISO, nowDate } = require('../utils/dateUtils');
const { getLevel } = require('./ivc.service');

function fireWebhook(url, payload) {
  if (!url) return;
  axios.post(url, payload, {
    headers: { 'x-cast-secret': process.env.N8N_WEBHOOK_SECRET },
    timeout: 5000,
  }).catch(e => console.warn(`Webhook ${url} failed:`, e.message));
}

// ─── RETRY LOGIC ─────────────────────────────────────────────────────────────
async function withRetry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
    }
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
async function getRange(sheet, range) {
  return withRetry(async () => {
    const sheets = await getSheets();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheet}!${range}` });
    return res.data.values || [];
  });
}

async function appendRow(sheet, values) {
  return withRetry(async () => {
    const sheets = await getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheet}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    });
  });
}

async function updateRow(sheet, rowIndex, values) {
  return withRetry(async () => {
    const sheets = await getSheets();
    const range = `${sheet}!A${rowIndex + 2}`; // +2: 1 for header, 1 for 0-index
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [values] },
    });
  });
}

async function findRowIndex(sheet, colA, value) {
  const rows = await getRange(sheet, 'A:A');
  return rows.findIndex((r, i) => i > 0 && r[0] === String(value));
}

// ─── LEADS ───────────────────────────────────────────────────────────────────
async function getAllLeads() {
  const rows = await getRange(SHEETS.LEADS, 'A:AP');
  return rows.slice(1).map(rowToLead).filter(l => l && l.stage !== 'deleted');
}

async function generateLeadCode() {
  const year  = new Date().getFullYear();
  const leads = await getAllLeads();
  const prefix = `CAST-${year}-`;
  const nums = leads
    .map(l => l.leadCode)
    .filter(c => c && c.startsWith(prefix))
    .map(c => parseInt(c.replace(prefix, '')) || 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

async function getLeadById(id) {
  const leads = await getAllLeads();
  return leads.find(l => String(l.id) === String(id)) || null;
}

async function createLead(leadData, userId, userName, userRole) {
  const id       = uuidv4();
  const now      = nowDate();
  const level    = getLevel(parseInt(leadData.score) || 0);
  const leadCode = await generateLeadCode();

  const lead = {
    ...leadData, id, level, leadCode,
    createdAt: now, updatedAt: now,
    reportIA: false, blueprintDone: false,
    ivcRS:0, ivcPP:0, ivcRT:0, ivcES:0, ivcScore: null,
    slaActive: false, slaStartTime: null,
    driveFolderId: null, loomUrl: null, deliverableUrl: null,
    nextActionAssignee: leadData.assignee,
  };

  await appendRow(SHEETS.LEADS, leadToRow(lead));
  await addActivityLog(id, userId, userName, userRole, 'Lead creado', `Entrada ${lead.entryType} en etapa ${lead.stage}`, lead.stage);

  // Dispara pipeline IA en n8n para todos los leads automáticos en stage 01
  if (lead.entryType === 'automatic' && lead.stage === '01') {
    fireWebhook(process.env.N8N_LEAD_RECEIVED, lead);
  }

  return lead;
}

async function updateLead(id, updates, userId, userName, userRole) {
  // Read ALL rows (including deleted) to find the true sheet row index.
  // Using getAllLeads() (filtered) would give a wrong index when deleted rows
  // exist above the target row, causing updateRow to overwrite the wrong row.
  const allRows = await getRange(SHEETS.LEADS, 'A:AO');
  const rowIdx  = allRows.findIndex((r, i) => i > 0 && r[0] === String(id));
  if (rowIdx === -1) throw new Error('Lead no encontrado');

  const lead    = rowToLead(allRows[rowIdx]);
  const updated = { ...lead, ...updates, updatedAt: nowISO() };
  if (updates.score !== undefined) updated.level = getLevel(parseInt(updates.score));

  await updateRow(SHEETS.LEADS, rowIdx - 1, leadToRow(updated));
  return updated;
}

async function updateLeadStage(id, newStage, userId, userName, userRole, reason = '') {
  const stageUpdates = { stage: newStage };

  if (newStage === '08') { stageUpdates.slaActive = true;  stageUpdates.slaStartTime = nowISO(); }
  if (newStage === '09') { stageUpdates.slaActive = false; }

  const updated = await updateLead(id, stageUpdates, userId, userName, userRole);
  await addActivityLog(id, userId, userName, userRole, `Movido a Etapa ${newStage}`, reason || `Stage cambiado a ${newStage}`, newStage);

  if (newStage === '17') {
    fireWebhook(process.env.N8N_NURTURING, {
      leadId: id, name: updated.name, email: updated.email,
      sector: updated.sector, level: updated.level,
    });
  }

  if (newStage === '18') {
    addToClosedLost(
      updated,
      updated.closedLostReason  || reason || '',
      updated.closedLostCategory || '',
      false,
    ).catch(() => {});
  }

  return updated;
}

async function deleteLead(id) {
  await updateLead(id, { stage: 'deleted', updatedAt: nowISO() }, 'system', 'Sistema', '');
}

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
async function addActivityLog(leadId, userId, userName, userRole, action, detail, stageAt, ipAddress = '') {
  const row = [
    uuidv4(), String(leadId), nowISO(),
    userId, userName, userRole,
    action, detail, stageAt, ipAddress,
  ];
  await appendRow(SHEETS.ACTIVITY, row);
}

async function getActivityByLeadId(leadId) {
  const rows = await getRange(SHEETS.ACTIVITY, 'A:J');
  return rows.slice(1)
    .map(rowToActivity).filter(Boolean)
    .filter(e => String(e.leadId) === String(leadId))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// ─── BLUEPRINT SESSIONS ───────────────────────────────────────────────────────
async function getBlueprintByLeadId(leadId) {
  const rows = await getRange(SHEETS.BLUEPRINT, 'A:BC');
  const row  = rows.slice(1).find(r => r[1] === String(leadId));
  return row ? rowToBlueprint(row) : null;
}

async function createBlueprint(leadId, userId) {
  const row = Array(56).fill('');
  row[0] = uuidv4();
  row[1] = String(leadId);
  row[2] = userId;
  row[3] = nowDate();
  await appendRow(SHEETS.BLUEPRINT, row);
  return getBlueprintByLeadId(leadId);
}

async function updateBlueprint(leadId, updates, userId) {
  const rows = await getRange(SHEETS.BLUEPRINT, 'A:BC');
  const idx  = rows.findIndex((r, i) => i > 0 && r[1] === String(leadId));
  if (idx === -1) return createBlueprint(leadId, userId);

  const existing = rows[idx];
  const merged   = mergeBlueprintRow(existing, updates);
  await updateRow(SHEETS.BLUEPRINT, idx - 1, merged);
  return getBlueprintByLeadId(leadId);
}

async function approveBlueprint(leadId, ceoUserId, ceoUserName) {
  const bp = await getBlueprintByLeadId(leadId);
  if (!bp) throw new Error('Sesión Blueprint no encontrada');
  if (!bp.outputGenerated) throw new Error('Output no generado aún');

  await updateBlueprint(leadId, {
    outputApprovedBy: ceoUserName,
    outputApprovedAt: nowISO(),
  }, ceoUserId);

  await updateLeadStage(leadId, '07', ceoUserId, ceoUserName, 'CEO', 'Output aprobado por CEO');
  await updateLead(leadId, { blueprintDone: true, slaActive: true, slaStartTime: nowISO() }, ceoUserId, ceoUserName, 'CEO');
  await addActivityLog(leadId, ceoUserId, ceoUserName, 'CEO', 'Output Blueprint aprobado', `Aprobado por ${ceoUserName} — Lead avanza a Etapa 07`, '07');
}

// ─── ATTACHMENTS ─────────────────────────────────────────────────────────────
async function addAttachment(leadId, data, userId) {
  const row = [uuidv4(), String(leadId), data.name, data.type, data.url, data.driveFileId||'', userId, nowISO(), data.stageAt||'', data.description||'', data.size||''];
  await appendRow(SHEETS.ATTACHMENTS, row);
}

async function getAttachmentsByLeadId(leadId) {
  const rows = await getRange(SHEETS.ATTACHMENTS, 'A:K');
  return rows.slice(1)
    .filter(r => r[1] === String(leadId))
    .map(r => ({ id:r[0], leadId:r[1], name:r[2], type:r[3], url:r[4], driveFileId:r[5], uploadedBy:r[6], uploadedAt:r[7], stageAt:r[8], description:r[9], size:r[10] }));
}

// ─── USERS ───────────────────────────────────────────────────────────────────
async function getUserByEmail(email) {
  const rows = await getRange(SHEETS.USERS, 'A:K');
  const row  = rows.slice(1).find(r => r[1] === email);
  return row ? rowToUser(row) : null;
}

async function updateLastLogin(userId) {
  const rows = await getRange(SHEETS.USERS, 'A:K');
  const idx  = rows.findIndex((r, i) => i > 0 && r[0] === String(userId));
  if (idx > -1) {
    rows[idx][8] = nowISO();
    await updateRow(SHEETS.USERS, idx - 1, rows[idx]);
  }
}

async function getAllUsers() {
  const rows = await getRange(SHEETS.USERS, 'A:K');
  return rows.slice(1).map(rowToUser).filter(r => r?.active);
}

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────
async function getDashboardStats() {
  const leads = await getAllLeads();
  const active  = leads.filter(l => !['14','15','18','deleted'].includes(l.stage));
  const won     = leads.filter(l => ['14','15'].includes(l.stage));

  const levelDist = { A:0, B:0, C:0, D:0 };
  leads.forEach(l => { if (levelDist[l.level] !== undefined) levelDist[l.level]++ });

  const stageMap = {};
  leads.forEach(l => {
    if (!stageMap[l.stage]) stageMap[l.stage] = { count:0, value:0 };
    stageMap[l.stage].count++;
    stageMap[l.stage].value += l.valueUSD;
  });

  return {
    leadsActive:      active.length,
    pipelineValueUSD: active.reduce((a,l) => a + l.valueUSD, 0),
    conversionRate:   leads.length ? Math.round((won.length / leads.length) * 100) : 0,
    blueprintSessions:leads.filter(l => l.flowType).length,
    slaAtRisk:        leads.filter(l => l.slaActive).length,
    levelDistribution:levelDist,
    stageDistribution:Object.entries(stageMap).map(([stage, d]) => ({ stage, ...d })),
    totalLeads:       leads.length,
  };
}

// ─── SEGUIMIENTO / CLOSED LOST ────────────────────────────────────────────────
async function addToClosedLost(lead, reason, category, recontact) {
  const row = [
    uuidv4(), lead.id, lead.name, lead.company, lead.email,
    lead.sector, lead.country, lead.blueprintSession?.sessionDate||'',
    lead.ivcScore||'', reason||'', category||'',
    recontact?'TRUE':'FALSE', '', nowISO(),
  ];
  await appendRow(SHEETS.CLOSED_LOST, row);
}

// ─── INTERNAL HELPERS ────────────────────────────────────────────────────────
function rowToBlueprint(row) {
  if (!row) return null;
  const r = row;
  return {
    id:r[0], leadId:r[1], conductedBy:r[2], sessionDate:r[3],
    phase00Done:r[4]==='TRUE', phase01Done:r[5]==='TRUE', phase02Done:r[6]==='TRUE',
    phase03Done:r[7]==='TRUE', phase04Done:r[8]==='TRUE', phase05Done:r[9]==='TRUE',
    phase02Notes:r[10]||'', phase04Heaven:r[11]||'', phase04Hell:r[12]||'', phase04Financial:r[13]||'',
    phase05Insights:r[14]||'', phase05FlowConfirmed:r[15]||'', phase05TierConfirmed:r[16]||'',
    phase05Payment50:r[17]==='TRUE',
    q1:r[18]||'', q2:r[19]||'', q3:r[20]||'', q4Sector:r[21]||'', q4International:r[22]==='TRUE',
    q5:r[23]||'', q5Amount:r[24]||'', q6:r[25]||'',
    q7:parseFloat(r[26])||0, q8:r[27]||'', q8Time:r[28]||'', q9:r[29]||'',
    q10:parseFloat(r[30])||0, q10Calc:parseFloat(r[31])||0,
    q11:r[32]||'', q11Time:r[33]||'',
    q12:r[34]||'', q12Rt:parseFloat(r[35])||0,
    q13:r[36]||'', q14:r[37]||'', q14Es:parseFloat(r[38])||0,
    q15:r[39]||'', q16:r[40]||'', q17:r[41]||'', q17Consultors:r[42]||'', q18:r[43]||'',
    q19Capital:r[44]||'', q20External:r[45]==='TRUE', q20Detail:r[46]||'',
    q21Range:r[47]||'', q21Tier:r[48]||null,
    blockH:r[49]||'',
    ivcCalculated:parseFloat(r[50])||null,
    outputGenerated:r[51]==='TRUE',
    outputApprovedBy:r[52]||null, outputApprovedAt:r[53]||null, outputNotes:r[54]||'',
  };
}

function mergeBlueprintRow(existing, updates) {
  const keys = ['id','leadId','conductedBy','sessionDate',
    'phase00Done','phase01Done','phase02Done','phase03Done','phase04Done','phase05Done',
    'phase02Notes','phase04Heaven','phase04Hell','phase04Financial',
    'phase05Insights','phase05FlowConfirmed','phase05TierConfirmed','phase05Payment50',
    'q1','q2','q3','q4Sector','q4International','q5','q5Amount','q6',
    'q7','q8','q8Time','q9','q10','q10Calc','q11','q11Time',
    'q12','q12Rt','q13','q14','q14Es','q15','q16','q17','q17Consultors','q18',
    'q19Capital','q20External','q20Detail','q21Range','q21Tier','blockH',
    'ivcCalculated','outputGenerated','outputApprovedBy','outputApprovedAt','outputNotes',
  ];
  return keys.map((k, i) => {
    if (updates[k] !== undefined) return updates[k] === true ? 'TRUE' : updates[k] === false ? 'FALSE' : updates[k];
    return existing[i] || '';
  });
}

module.exports = {
  getAllLeads, getLeadById, createLead, updateLead, updateLeadStage, deleteLead,
  generateLeadCode,
  addActivityLog, getActivityByLeadId,
  getBlueprintByLeadId, createBlueprint, updateBlueprint, approveBlueprint,
  addAttachment, getAttachmentsByLeadId,
  getUserByEmail, updateLastLogin, getAllUsers,
  getDashboardStats, addToClosedLost,
};
