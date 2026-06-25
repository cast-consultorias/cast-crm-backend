/**
 * Migración: Google Sheets → Supabase
 * Ejecutar una sola vez: node scripts/migrateToSupabase.js
 *
 * Migra en orden: Users → Leads → ActivityLog → BlueprintSessions → Attachments → ClosedLost
 * Usa upsert (on conflict do nothing) — se puede correr múltiples veces de forma segura.
 */
require('dotenv').config();

const { createClient }  = require('@supabase/supabase-js');
const { getSheets }     = require('../config/google');
const { SPREADSHEET_ID, SHEETS } = require('../config/sheets');
const { rowToLead, rowToActivity, rowToUser } = require('../utils/formatters');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── HELPERS ──────────────────────────────────────────────────────

async function getRange(sheet, range) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!${range}`,
  });
  return res.data.values || [];
}

function toBool(v) { return v === true || v === 'TRUE' || v === 'true' || v === '1'; }
function toNum(v)  { return v === '' || v == null ? null : parseFloat(v); }

async function upsertBatch(table, rows, conflictCol = 'id') {
  if (!rows.length) return 0;
  const CHUNK = 100;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict: conflictCol, ignoreDuplicates: true });
    if (error) throw new Error(`[${table}] ${error.message}`);
    total += chunk.length;
  }
  return total;
}

// ─── USERS ────────────────────────────────────────────────────────

async function migrateUsers() {
  process.stdout.write('Migrando users... ');
  const rows = await getRange(SHEETS.USERS, 'A:K');
  const users = rows.slice(1).map(rowToUser).filter(Boolean).map(u => ({
    id:            u.id,
    email:         u.email,
    password_hash: u.passwordHash,
    name:          u.name,
    role:          u.role,
    is_ceo:        u.isCEO,
    active:        u.active,
    created_at:    u.createdAt || new Date().toISOString(),
    last_login:    u.lastLogin || null,
    color:         u.color || null,
    initials:      u.initials || null,
  }));

  const n = await upsertBatch('users', users, 'email');
  console.log(`✅ ${n} procesados (${users.length} en Sheets)`);
  return users.length;
}

// ─── LEADS ────────────────────────────────────────────────────────

async function migrateLeads() {
  process.stdout.write('Migrando leads... ');
  const rows = await getRange(SHEETS.LEADS, 'A:AP');
  const leads = rows.slice(1).map(rowToLead).filter(Boolean).map(l => ({
    id:                   l.id,
    name:                 l.name || '(sin nombre)',
    company:              l.company || null,
    email:                l.email || null,
    phone:                l.phone || null,
    country:              l.country || null,
    sector:               l.sector || null,
    score:                l.score || 0,
    level:                l.level || null,
    stage:                l.stage || '01',
    value_usd:            l.valueUSD || 0,
    probability:          l.probability || 0,
    pain_type:            l.painType || null,
    project_stage:        l.projectStage || null,
    source:               l.source || null,
    assignee:             l.assignee || null,
    flow_type:            l.flowType || null,
    tier:                 l.tier || null,
    report_ia:            l.reportIA || false,
    blueprint_done:       l.blueprintDone || false,
    ivc_rs:               l.ivcRS || 0,
    ivc_pp:               l.ivcPP || 0,
    ivc_rt:               l.ivcRT || 0,
    ivc_es:               l.ivcES || 0,
    ivc_score:            l.ivcScore ?? null,
    sla_active:           l.slaActive || false,
    sla_start_time:       l.slaStartTime || null,
    notes:                l.notes || null,
    created_at:           l.createdAt || new Date().toISOString(),
    updated_at:           l.updatedAt || new Date().toISOString(),
    entry_type:           l.entryType || 'automatic',
    drive_folder_id:      l.driveFolderId || null,
    loom_url:             l.loomUrl || null,
    deliverable_url:      l.deliverableUrl || null,
    next_action:          l.nextAction || null,
    next_action_date:     l.nextActionDate || null,
    next_action_assignee: l.nextActionAssignee || null,
    closed_lost_reason:   l.closedLostReason || null,
    closed_lost_category: l.closedLostCategory || null,
    recontact_date:       l.recontactDate || null,
    report_content:       l.reportContent || null,
    lead_code:            l.leadCode || null,
  }));

  const n = await upsertBatch('leads', leads);
  console.log(`✅ ${n} procesados (${leads.length} en Sheets)`);
  return leads.length;
}

// ─── ACTIVITY LOG ─────────────────────────────────────────────────

async function migrateActivity() {
  process.stdout.write('Migrando activity_log... ');
  const rows = await getRange(SHEETS.ACTIVITY, 'A:J');
  const entries = rows.slice(1).map(rowToActivity).filter(Boolean).map(a => ({
    id:         a.id,
    lead_id:    a.leadId,
    timestamp:  a.timestamp || new Date().toISOString(),
    user_id:    a.userId || '',
    user_name:  a.userName || '',
    user_role:  a.userRole || null,
    action:     a.action || '',
    detail:     a.detail || null,
    stage_at:   a.stageAt || null,
    ip_address: a.ipAddress || null,
  }));

  // Filtra entradas cuyo lead_id exista en Supabase
  const { data: existingLeads } = await supabase.from('leads').select('id');
  const leadIds = new Set((existingLeads || []).map(l => l.id));
  const valid = entries.filter(e => leadIds.has(e.lead_id));
  const skipped = entries.length - valid.length;

  const n = await upsertBatch('activity_log', valid);
  console.log(`✅ ${n} procesados${skipped ? ` (${skipped} omitidos — lead no encontrado)` : ''}`);
  return valid.length;
}

// ─── BLUEPRINT SESSIONS ───────────────────────────────────────────

async function migrateBlueprints() {
  process.stdout.write('Migrando blueprint_sessions... ');
  const rows = await getRange(SHEETS.BLUEPRINT, 'A:BC');

  const { data: existingLeads } = await supabase.from('leads').select('id');
  const leadIds = new Set((existingLeads || []).map(l => l.id));

  const sessions = rows.slice(1).filter(r => r[0] && r[1] && leadIds.has(r[1])).map(r => ({
    id:                     r[0],
    lead_id:                r[1],
    conducted_by:           r[2] || null,
    session_date:           r[3] || null,
    phase00_done:           toBool(r[4]),
    phase01_done:           toBool(r[5]),
    phase02_done:           toBool(r[6]),
    phase03_done:           toBool(r[7]),
    phase04_done:           toBool(r[8]),
    phase05_done:           toBool(r[9]),
    phase02_notes:          r[10] || null,
    phase04_heaven:         r[11] || null,
    phase04_hell:           r[12] || null,
    phase04_financial:      r[13] || null,
    phase05_insights:       r[14] || null,
    phase05_flow_confirmed: r[15] || null,
    phase05_tier_confirmed: r[16] || null,
    phase05_payment50:      toBool(r[17]),
    q1:                     r[18] || null,
    q2:                     r[19] || null,
    q3:                     r[20] || null,
    q4_sector:              r[21] || null,
    q4_international:       toBool(r[22]),
    q5:                     r[23] || null,
    q5_amount:              r[24] || null,
    q6:                     r[25] || null,
    q7:                     toNum(r[26]) || 0,
    q8:                     r[27] || null,
    q8_time:                r[28] || null,
    q9:                     r[29] || null,
    q10:                    toNum(r[30]) || 0,
    q10_calc:               toNum(r[31]) || 0,
    q11:                    r[32] || null,
    q11_time:               r[33] || null,
    q12:                    r[34] || null,
    q12_rt:                 toNum(r[35]) || 0,
    q13:                    r[36] || null,
    q14:                    r[37] || null,
    q14_es:                 toNum(r[38]) || 0,
    q15:                    r[39] || null,
    q16:                    r[40] || null,
    q17:                    r[41] || null,
    q17_consultors:         r[42] || null,
    q18:                    r[43] || null,
    q19_capital:            r[44] || null,
    q20_external:           toBool(r[45]),
    q20_detail:             r[46] || null,
    q21_range:              r[47] || null,
    q21_tier:               r[48] || null,
    block_h:                r[49] || null,
    ivc_calculated:         toNum(r[50]),
    output_generated:       toBool(r[51]),
    output_approved_by:     r[52] || null,
    output_approved_at:     r[53] || null,
    output_notes:           r[54] || null,
  }));

  const skipped = rows.slice(1).length - sessions.length;
  const n = await upsertBatch('blueprint_sessions', sessions, 'lead_id');
  console.log(`✅ ${n} procesados${skipped ? ` (${skipped} omitidos — lead no encontrado)` : ''}`);
  return sessions.length;
}

// ─── ATTACHMENTS ──────────────────────────────────────────────────

async function migrateAttachments() {
  process.stdout.write('Migrando attachments... ');
  const rows = await getRange(SHEETS.ATTACHMENTS, 'A:K');

  const { data: existingLeads } = await supabase.from('leads').select('id');
  const leadIds = new Set((existingLeads || []).map(l => l.id));

  const items = rows.slice(1)
    .filter(r => r[0] && r[1] && leadIds.has(r[1]))
    .map(r => ({
      id:            r[0],
      lead_id:       r[1],
      name:          r[2] || '(sin nombre)',
      type:          r[3] || null,
      url:           r[4] || null,
      drive_file_id: r[5] || null,
      uploaded_by:   r[6] || null,
      uploaded_at:   r[7] || new Date().toISOString(),
      stage_at:      r[8] || null,
      description:   r[9] || null,
      size:          r[10] || null,
    }));

  const skipped = rows.slice(1).length - items.length;
  const n = await upsertBatch('attachments', items);
  console.log(`✅ ${n} procesados${skipped ? ` (${skipped} omitidos)` : ''}`);
  return items.length;
}

// ─── CLOSED LOST ──────────────────────────────────────────────────

async function migrateClosedLost() {
  process.stdout.write('Migrando closed_lost... ');
  const rows = await getRange(SHEETS.CLOSED_LOST, 'A:N');

  const items = rows.slice(1).filter(r => r[0]).map(r => ({
    id:           r[0],
    lead_id:      r[1] || null,
    name:         r[2] || null,
    company:      r[3] || null,
    email:        r[4] || null,
    sector:       r[5] || null,
    country:      r[6] || null,
    session_date: r[7] || null,
    ivc_score:    toNum(r[8]),
    reason:       r[9] || null,
    category:     r[10] || null,
    recontact:    toBool(r[11]),
    notes:        r[12] || null,
    closed_at:    r[13] || new Date().toISOString(),
  }));

  const n = await upsertBatch('closed_lost', items);
  console.log(`✅ ${n} procesados`);
  return items.length;
}

// ─── MAIN ─────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('  CAST CRM — Migración Google Sheets → Supabase');
  console.log('═══════════════════════════════════════════════\n');

  const start = Date.now();
  try {
    await migrateUsers();
    const leads     = await migrateLeads();
    await migrateActivity();
    await migrateBlueprints();
    await migrateAttachments();
    await migrateClosedLost();

    const secs = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n🎉 Migración completada en ${secs}s`);
    console.log(`   Verificar en: https://supabase.com/dashboard/project/fehnyryrwquxilhifdpm/editor`);
  } catch (err) {
    console.error('\n❌ Error durante migración:', err.message);
    process.exit(1);
  }
}

main();
