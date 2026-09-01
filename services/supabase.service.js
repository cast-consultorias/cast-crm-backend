const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { getLevel } = require('./ivc.service');
const { nowISO, nowDate } = require('../utils/dateUtils');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function fireWebhook(url, payload) {
  if (!url) return;
  axios.post(url, payload, {
    headers: { 'x-cast-secret': process.env.N8N_WEBHOOK_SECRET },
    timeout: 5000,
  }).catch(e => console.warn(`Webhook ${url} failed:`, e.message));
}

// ─── MAPPERS ──────────────────────────────────────────────────────

function dbToLead(row) {
  if (!row) return null;
  return {
    id:                  row.id,
    name:                row.name,
    company:             row.company || '',
    email:               row.email || '',
    phone:               row.phone || '',
    country:             row.country || '',
    sector:              row.sector || '',
    score:               row.score || 0,
    level:               row.level || '',
    stage:               row.stage,
    valueUSD:            row.value_usd || 0,
    probability:         row.probability || 0,
    painType:            row.pain_type || '',
    projectStage:        row.project_stage || '',
    source:              row.source || '',
    assignee:            row.assignee || '',
    flowType:            row.flow_type || null,
    tier:                row.tier || null,
    reportIA:            row.report_ia || false,
    blueprintDone:       row.blueprint_done || false,
    ivcRS:               parseFloat(row.ivc_rs) || 0,
    ivcPP:               parseFloat(row.ivc_pp) || 0,
    ivcRT:               parseFloat(row.ivc_rt) || 0,
    ivcES:               parseFloat(row.ivc_es) || 0,
    ivcScore:            row.ivc_score != null ? parseFloat(row.ivc_score) : null,
    slaActive:           row.sla_active || false,
    slaStartTime:        row.sla_start_time || null,
    notes:               row.notes || '',
    createdAt:           row.created_at,
    updatedAt:           row.updated_at,
    entryType:           row.entry_type || 'automatic',
    driveFolderId:       row.drive_folder_id || null,
    loomUrl:             row.loom_url || null,
    deliverableUrl:      row.deliverable_url || null,
    nextAction:          row.next_action || '',
    nextActionDate:      row.next_action_date || null,
    nextActionAssignee:  row.next_action_assignee || '',
    closedLostReason:    row.closed_lost_reason || null,
    closedLostCategory:  row.closed_lost_category || null,
    recontactDate:       row.recontact_date || null,
    reportContent:       row.report_content || null,
    leadCode:            row.lead_code || null,
  };
}

function leadToDb(lead) {
  return {
    id:                   lead.id,
    name:                 lead.name,
    company:              lead.company || null,
    email:                lead.email || null,
    phone:                lead.phone || null,
    country:              lead.country || null,
    sector:               lead.sector || null,
    score:                lead.score || 0,
    level:                lead.level || null,
    stage:                lead.stage,
    value_usd:            lead.valueUSD || 0,
    probability:          lead.probability || 0,
    pain_type:            lead.painType || null,
    project_stage:        lead.projectStage || null,
    source:               lead.source || null,
    assignee:             lead.assignee || null,
    flow_type:            lead.flowType || null,
    tier:                 lead.tier || null,
    report_ia:            lead.reportIA || false,
    blueprint_done:       lead.blueprintDone || false,
    ivc_rs:               lead.ivcRS || 0,
    ivc_pp:               lead.ivcPP || 0,
    ivc_rt:               lead.ivcRT || 0,
    ivc_es:               lead.ivcES || 0,
    ivc_score:            lead.ivcScore ?? null,
    sla_active:           lead.slaActive || false,
    sla_start_time:       lead.slaStartTime || null,
    notes:                lead.notes || null,
    created_at:           lead.createdAt,
    updated_at:           lead.updatedAt,
    entry_type:           lead.entryType || 'automatic',
    drive_folder_id:      lead.driveFolderId || null,
    loom_url:             lead.loomUrl || null,
    deliverable_url:      lead.deliverableUrl || null,
    next_action:          lead.nextAction || null,
    next_action_date:     lead.nextActionDate || null,
    next_action_assignee: lead.nextActionAssignee || null,
    closed_lost_reason:   lead.closedLostReason || null,
    closed_lost_category: lead.closedLostCategory || null,
    recontact_date:       lead.recontactDate || null,
    report_content:       lead.reportContent || null,
    lead_code:            lead.leadCode || null,
  };
}

function dbToBlueprint(row) {
  if (!row) return null;
  return {
    id:                   row.id,
    leadId:               row.lead_id,
    conductedBy:          row.conducted_by || null,
    sessionDate:          row.session_date || null,
    phase00Done:          row.phase00_done || false,
    phase01Done:          row.phase01_done || false,
    phase02Done:          row.phase02_done || false,
    phase03Done:          row.phase03_done || false,
    phase04Done:          row.phase04_done || false,
    phase05Done:          row.phase05_done || false,
    chk00a:               row.chk00a || false,
    chk00b:               row.chk00b || false,
    chk00c:               row.chk00c || false,
    chk00d:               row.chk00d || false,
    chk01a:               row.chk01a || false,
    chk01b:               row.chk01b || false,
    chk01c:               row.chk01c || false,
    chk02a:               row.chk02a || false,
    phase02Notes:         row.phase02_notes || '',
    phase04Heaven:        row.phase04_heaven || '',
    phase04Hell:          row.phase04_hell || '',
    phase04Financial:     row.phase04_financial || '',
    phase05Mirror:        row.phase05_mirror || '',
    phase05Insights:      row.phase05_insights || '',
    phase05FlowConfirmed: row.phase05_flow_confirmed || '',
    phase05TierConfirmed: row.phase05_tier_confirmed || '',
    phase05Payment50:     row.phase05_payment50 || false,
    q1:                   row.q1 || '',
    q2:                   row.q2 || '',
    q3:                   row.q3 || '',
    q4Sector:             row.q4_sector || '',
    q4International:      row.q4_international || false,
    q5:                   row.q5 || '',
    q5Amount:             row.q5_amount || '',
    q6:                   row.q6 || '',
    q7:                   parseFloat(row.q7) || 0,
    q8:                   row.q8 || '',
    q8Time:               row.q8_time || '',
    q9:                   row.q9 || '',
    q10:                  parseFloat(row.q10) || 0,
    q10Calc:              parseFloat(row.q10_calc) || 0,
    q11:                  row.q11 || '',
    q11Time:              row.q11_time || '',
    q12:                  row.q12 || '',
    q12Rt:                parseFloat(row.q12_rt) || 0,
    q13:                  row.q13 || '',
    q14:                  row.q14 || '',
    q14Es:                parseFloat(row.q14_es) || 0,
    q15:                  row.q15 || '',
    q16:                  row.q16 || '',
    q17:                  row.q17 || '',
    q17Consultors:        row.q17_consultors || '',
    q18:                  row.q18 || '',
    q19Capital:           row.q19_capital || '',
    q20External:          row.q20_external || false,
    q20Detail:            row.q20_detail || '',
    q21Range:             row.q21_range || '',
    q21Tier:              row.q21_tier || null,
    blockH:               row.block_h || '',
    ivcCalculated:        row.ivc_calculated != null ? parseFloat(row.ivc_calculated) : null,
    outputGenerated:      row.output_generated || false,
    outputApprovedBy:     row.output_approved_by || null,
    outputApprovedAt:     row.output_approved_at || null,
    outputNotes:          row.output_notes || '',
  };
}

function blueprintUpdatesToDb(updates) {
  const map = {
    conductedBy:'conducted_by', sessionDate:'session_date',
    phase00Done:'phase00_done', phase01Done:'phase01_done',
    phase02Done:'phase02_done', phase03Done:'phase03_done',
    phase04Done:'phase04_done', phase05Done:'phase05_done',
    chk00a:'chk00a', chk00b:'chk00b', chk00c:'chk00c', chk00d:'chk00d',
    chk01a:'chk01a', chk01b:'chk01b', chk01c:'chk01c',
    chk02a:'chk02a',
    phase02Notes:'phase02_notes',
    phase04Heaven:'phase04_heaven', phase04Hell:'phase04_hell',
    phase04Financial:'phase04_financial', phase05Mirror:'phase05_mirror',
    phase05Insights:'phase05_insights', phase05FlowConfirmed:'phase05_flow_confirmed',
    phase05TierConfirmed:'phase05_tier_confirmed', phase05Payment50:'phase05_payment50',
    q1:'q1', q2:'q2', q3:'q3',
    q4Sector:'q4_sector', q4International:'q4_international',
    q5:'q5', q5Amount:'q5_amount', q6:'q6',
    q7:'q7', q8:'q8', q8Time:'q8_time', q9:'q9',
    q10:'q10', q10Calc:'q10_calc', q11:'q11', q11Time:'q11_time',
    q12:'q12', q12Rt:'q12_rt', q13:'q13',
    q14:'q14', q14Es:'q14_es', q15:'q15', q16:'q16',
    q17:'q17', q17Consultors:'q17_consultors', q18:'q18',
    q19Capital:'q19_capital', q20External:'q20_external', q20Detail:'q20_detail',
    q21Range:'q21_range', q21Tier:'q21_tier', blockH:'block_h',
    ivcCalculated:'ivc_calculated', outputGenerated:'output_generated',
    outputApprovedBy:'output_approved_by', outputApprovedAt:'output_approved_at',
    outputNotes:'output_notes',
  };
  const result = {};
  for (const [k, v] of Object.entries(updates)) {
    if (map[k] !== undefined) result[map[k]] = v;
  }
  return result;
}

function dbToUser(row) {
  if (!row) return null;
  return {
    id:           row.id,
    email:        row.email,
    passwordHash: row.password_hash,
    name:         row.name,
    role:         row.role,
    isCEO:        row.is_ceo || false,
    active:       row.active || false,
    createdAt:    row.created_at,
    lastLogin:    row.last_login,
    color:        row.color,
    initials:     row.initials,
  };
}

// ─── LEADS ────────────────────────────────────────────────────────

async function getAllLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .neq('stage', 'deleted')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(dbToLead);
}

async function generateLeadCode() {
  const year = new Date().getFullYear();
  const prefix = `CAST-${year}-`;
  const { data, error } = await supabase
    .from('leads')
    .select('lead_code')
    .like('lead_code', `${prefix}%`)
    .order('lead_code', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data.length || !data[0].lead_code) return `${prefix}001`;
  const num = parseInt(data[0].lead_code.replace(prefix, '')) || 0;
  return `${prefix}${String(num + 1).padStart(3, '0')}`;
}

async function getLeadById(id) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return dbToLead(data);
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
    ivcRS: 0, ivcPP: 0, ivcRT: 0, ivcES: 0, ivcScore: null,
    slaActive: false, slaStartTime: null,
    driveFolderId: null, loomUrl: null, deliverableUrl: null,
    nextActionAssignee: leadData.assignee,
  };

  const { error } = await supabase.from('leads').insert(leadToDb(lead));
  if (error) throw error;

  await addActivityLog(id, userId, userName, userRole, 'Lead creado', `Entrada ${lead.entryType} en etapa ${lead.stage}`, lead.stage);

  if (lead.entryType === 'automatic' && lead.stage === '01') {
    fireWebhook(process.env.N8N_LEAD_RECEIVED, lead);
  }

  return lead;
}

async function updateLead(id, updates, userId, userName, userRole) {
  const existing = await getLeadById(id);
  if (!existing) throw new Error('Lead no encontrado');

  const merged = { ...existing, ...updates, updatedAt: nowISO() };
  if (updates.score !== undefined) merged.level = getLevel(parseInt(updates.score));

  const { error } = await supabase
    .from('leads')
    .update(leadToDb(merged))
    .eq('id', id);
  if (error) throw error;

  return merged;
}

async function updateLeadStage(id, newStage, userId, userName, userRole, reason = '') {
  const stageUpdates = { stage: newStage };

  if (newStage === '05') { stageUpdates.slaStartTime = nowISO(); }
  if (newStage === '08') { stageUpdates.slaActive = true;  stageUpdates.slaStartTime = nowISO(); }
  if (newStage === '09') { stageUpdates.slaActive = false; stageUpdates.slaStartTime = nowISO(); }
  if (newStage === '10') { stageUpdates.slaStartTime = nowISO(); }

  const updated = await updateLead(id, stageUpdates, userId, userName, userRole);
  await addActivityLog(id, userId, userName, userRole, `Movido a Etapa ${newStage}`, reason || `Stage cambiado a ${newStage}`, newStage);

  if (newStage === '19') {
    fireWebhook(process.env.N8N_NURTURING, {
      leadId: id, name: updated.name, email: updated.email,
      sector: updated.sector, level: updated.level,
    });
  }

  if (newStage === '20') {
    addToClosedLost(updated, updated.closedLostReason || reason || '', updated.closedLostCategory || '', false)
      .catch(() => {});
  }

  return updated;
}

async function deleteLead(id) {
  await updateLead(id, { stage: 'deleted', updatedAt: nowISO() }, 'system', 'Sistema', '');
}

// ─── ACTIVITY LOG ─────────────────────────────────────────────────

async function addActivityLog(leadId, userId, userName, userRole, action, detail, stageAt, ipAddress = '') {
  const { error } = await supabase.from('activity_log').insert({
    id: uuidv4(),
    lead_id:    leadId,
    timestamp:  nowISO(),
    user_id:    String(userId),
    user_name:  userName,
    user_role:  userRole,
    action,
    detail,
    stage_at:   stageAt,
    ip_address: ipAddress,
  });
  if (error) throw error;
}

async function getActivityByLeadId(leadId) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('lead_id', leadId)
    .order('timestamp', { ascending: false });
  if (error) throw error;
  return data.map(r => ({
    id: r.id, leadId: r.lead_id, timestamp: r.timestamp,
    userId: r.user_id, userName: r.user_name, userRole: r.user_role,
    action: r.action, detail: r.detail, stageAt: r.stage_at, ipAddress: r.ip_address,
  }));
}

// ─── BLUEPRINT SESSIONS ───────────────────────────────────────────

async function getBlueprintByLeadId(leadId) {
  const { data, error } = await supabase
    .from('blueprint_sessions')
    .select('*')
    .eq('lead_id', leadId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return dbToBlueprint(data);
}

async function createBlueprint(leadId, userId) {
  const { data, error } = await supabase
    .from('blueprint_sessions')
    .insert({ lead_id: leadId, conducted_by: userId, session_date: nowDate().split('T')[0] })
    .select()
    .single();
  if (error) throw error;
  return dbToBlueprint(data);
}

async function updateBlueprint(leadId, updates, userId) {
  const exists = await getBlueprintByLeadId(leadId);
  const dbUpdates = blueprintUpdatesToDb(updates);

  if (!exists) {
    const { data, error } = await supabase
      .from('blueprint_sessions')
      .insert({ lead_id: leadId, conducted_by: userId, ...dbUpdates })
      .select()
      .single();
    if (error) throw error;
    return dbToBlueprint(data);
  }

  const { data, error } = await supabase
    .from('blueprint_sessions')
    .update({ ...dbUpdates, updated_at: nowISO() })
    .eq('lead_id', leadId)
    .select()
    .single();
  if (error) throw error;
  return dbToBlueprint(data);
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

// ─── BLUEPRINT SESSIONS FDE+PMP (nuevo — dominio distinto de blueprint_sessions/IVC arriba) ───
// Ver docs/cast-strategy/CAST_BLUEPRINTS_FDE_PMP_v1.0_ANTIGRAVITY_IMPLEMENTATION.md
// Fase 2 — CRUD de sesión + máquina de estados (§12). Nota: la Sección 34 del Master
// Spec (.docx) no está disponible en este repo — las transiciones abajo son la lectura
// más conservadora de la secuencia de §12, no una copia de esa sección.

const BPFDE_TRANSITIONS = {
  DRAFT:           ['READY', 'ARCHIVED'],
  READY:           ['IN_PROGRESS', 'ARCHIVED'],
  IN_PROGRESS:     ['PAUSED', 'PENDING_REVIEW', 'ARCHIVED'],
  PAUSED:          ['IN_PROGRESS', 'ARCHIVED'],
  PENDING_REVIEW:  ['IN_PROGRESS', 'COMPLETED', 'ARCHIVED'],
  COMPLETED:       ['ANALYSIS', 'ARCHIVED'],
  ANALYSIS:        ['BLUEPRINT_READY', 'ARCHIVED'],
  BLUEPRINT_READY: ['HANDED_OFF', 'ARCHIVED'],
  HANDED_OFF:      ['ARCHIVED'],
  ARCHIVED:        [],
};

function dbToBpFdeSession(row) {
  if (!row) return null;
  return {
    id:                 row.id,
    leadId:             row.lead_id,
    status:             row.status,
    mode:               row.mode,
    questionSetVersion: row.question_set_version,
    conductedBy:        row.conducted_by,
    fdeSupervisorId:    row.fde_supervisor_id,
    startedAt:          row.started_at,
    completedAt:        row.completed_at,
    handedOffAt:        row.handed_off_at,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  };
}

async function addBpFdeAuditLog(sessionId, actorId, actorRole, action, before, after) {
  const { error } = await supabase.from('blueprint_audit_log').insert({
    session_id: sessionId,
    actor_id:   actorId || null,
    actor_role: actorRole || null,
    action,
    before:     before ?? null,
    after:      after ?? null,
  });
  if (error) throw error;
}

async function createBpFdeSession(leadId, userId, userRole, { mode } = {}) {
  const { data, error } = await supabase
    .from('blueprint_sessions_fde')
    .insert({ lead_id: leadId, conducted_by: userId, mode: mode || 'A' })
    .select()
    .single();
  if (error) throw error;
  const session = dbToBpFdeSession(data);
  await addBpFdeAuditLog(session.id, userId, userRole, 'session_created', null, { status: session.status, mode: session.mode });
  return session;
}

async function getBpFdeSessionById(id) {
  const { data, error } = await supabase.from('blueprint_sessions_fde').select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw error;
  return dbToBpFdeSession(data);
}

async function getBpFdeSessionsByLead(leadId) {
  const { data, error } = await supabase
    .from('blueprint_sessions_fde')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(dbToBpFdeSession);
}

async function updateBpFdeSession(id, updates, userId, userRole) {
  const before = await getBpFdeSessionById(id);
  if (!before) throw new Error('Sesión Blueprint FDE+PMP no encontrada');

  const dbUpdates = {};
  if (updates.mode !== undefined)            dbUpdates.mode = updates.mode;
  if (updates.fdeSupervisorId !== undefined) dbUpdates.fde_supervisor_id = updates.fdeSupervisorId;
  if (Object.keys(dbUpdates).length === 0) return before;
  dbUpdates.updated_at = nowISO();

  const { data, error } = await supabase
    .from('blueprint_sessions_fde')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  const after = dbToBpFdeSession(data);
  await addBpFdeAuditLog(id, userId, userRole, 'session_updated', before, after);
  return after;
}

async function transitionBpFdeSessionStatus(id, newStatus, userId, userRole) {
  const before = await getBpFdeSessionById(id);
  if (!before) throw new Error('Sesión Blueprint FDE+PMP no encontrada');

  const allowed = BPFDE_TRANSITIONS[before.status] || [];
  if (!allowed.includes(newStatus)) {
    const err = new Error(`Transición inválida: ${before.status} → ${newStatus}. Permitidas: ${allowed.join(', ') || 'ninguna (estado terminal)'}`);
    err.statusCode = 400;
    throw err;
  }

  const dbUpdates = { status: newStatus, updated_at: nowISO() };
  if (newStatus === 'IN_PROGRESS' && !before.startedAt) dbUpdates.started_at = nowISO();
  if (newStatus === 'COMPLETED')  dbUpdates.completed_at = nowISO();
  if (newStatus === 'HANDED_OFF') dbUpdates.handed_off_at = nowISO();

  const { data, error } = await supabase
    .from('blueprint_sessions_fde')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  const after = dbToBpFdeSession(data);
  await addBpFdeAuditLog(id, userId, userRole, 'status_change', { status: before.status }, { status: after.status });
  return after;
}

// ─── BLUEPRINTS FDE+PMP — Question Engine (Fase 4) ───────────────────────────
// Banco de preguntas versionado (§06/§07) + respuestas. Fase 4 solo carga y
// permite navegar/responder el banco base — la activación condicional de
// subpreguntas (G04.1..J01.4) es Fase 5, aunque ya vienen sembradas como datos.

function dbToBpFdeQuestion(row) {
  return {
    code:               row.code,
    block:              row.block,
    blockName:          row.block_name,
    prompt:             row.prompt,
    questionType:       row.question_type,
    parentCode:         row.parent_code,
    orderIndex:         row.order_index,
    allowUnknown:       row.allow_unknown,
    questionSetVersion: row.question_set_version,
  };
}

async function getBpFdeQuestionBank(version = 1) {
  const [{ data: questions, error: qErr }, { data: rules, error: rErr }] = await Promise.all([
    supabase.from('blueprint_questions').select('*').eq('question_set_version', version).order('block').order('order_index'),
    supabase.from('blueprint_question_rules').select('*').eq('question_set_version', version),
  ]);
  if (qErr) throw qErr;
  if (rErr) throw rErr;
  return {
    questions: (questions || []).map(dbToBpFdeQuestion),
    rules: (rules || []).map(r => ({ triggerQuestionCode: r.trigger_question_code, triggerValue: r.trigger_value, activatesQuestionCode: r.activates_question_code })),
  };
}

function dbToBpFdeAnswer(row) {
  return {
    id:                 row.id,
    sessionId:          row.session_id,
    questionCode:       row.question_code,
    questionSetVersion: row.question_set_version,
    answerText:         row.answer_text,
    answerValue:        row.answer_value,
    confidence:         row.confidence,
    status:             row.status,
    capturedVia:        row.captured_via,
    confirmedBy:        row.confirmed_by,
    confirmedAt:        row.confirmed_at,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  };
}

async function getBpFdeAnswers(sessionId) {
  const { data, error } = await supabase.from('blueprint_answers').select('*').eq('session_id', sessionId);
  if (error) throw error;
  return (data || []).map(dbToBpFdeAnswer);
}

// Fase 4/6: el FDE escribe o dicta la respuesta directamente (✎ Escribir / 🎙 Hablar)
// — sin estructuración por IA todavía (Fase 7), así que queda PM_CONFIRMED de una vez.
async function upsertBpFdeAnswer(sessionId, questionCode, questionSetVersion, answerText, userId, userRole, capturedVia = 'text') {
  const { data, error } = await supabase
    .from('blueprint_answers')
    .upsert({
      session_id: sessionId,
      question_code: questionCode,
      question_set_version: questionSetVersion,
      answer_text: answerText,
      status: 'PM_CONFIRMED',
      captured_via: capturedVia,
      confirmed_by: userId,
      confirmed_at: nowISO(),
      updated_at: nowISO(),
    }, { onConflict: 'session_id,question_code' })
    .select()
    .single();
  if (error) throw error;
  const answer = dbToBpFdeAnswer(data);
  await addBpFdeAuditLog(sessionId, userId, userRole, 'answer_saved', null, { questionCode, answerText, capturedVia });
  return answer;
}

// ─── BLUEPRINTS FDE+PMP — Voz (Fase 6) ───────────────────────────────────────
// Consentimiento obligatorio antes de la primera grabación (§09). Se inserta un
// registro nuevo cada vez que se pide/decide — se lee el más reciente por sesión.

function dbToBpFdeVoiceConsent(row) {
  if (!row) return null;
  return { id: row.id, sessionId: row.session_id, authorized: row.authorized, capturedBy: row.captured_by, capturedAt: row.captured_at, notes: row.notes };
}

async function getBpFdeVoiceConsent(sessionId) {
  const { data, error } = await supabase
    .from('blueprint_voice_consents')
    .select('*').eq('session_id', sessionId)
    .order('captured_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return dbToBpFdeVoiceConsent(data);
}

async function setBpFdeVoiceConsent(sessionId, authorized, userId, userRole) {
  const { data, error } = await supabase
    .from('blueprint_voice_consents')
    .insert({ session_id: sessionId, authorized, captured_by: userId })
    .select().single();
  if (error) throw error;
  const consent = dbToBpFdeVoiceConsent(data);
  await addBpFdeAuditLog(sessionId, userId, userRole, 'voice_consent', null, { authorized });
  return consent;
}

function dbToBpFdeTranscript(row) {
  return { id: row.id, sessionId: row.session_id, speaker: row.speaker, textContent: row.text_content, audioUrl: row.audio_url, createdAt: row.created_at };
}

async function addBpFdeTranscript(sessionId, speaker, textContent) {
  const { data, error } = await supabase
    .from('blueprint_transcripts')
    .insert({ session_id: sessionId, speaker: speaker || 'UNKNOWN', text_content: textContent })
    .select().single();
  if (error) throw error;
  return dbToBpFdeTranscript(data);
}

async function getBpFdeTranscripts(sessionId) {
  const { data, error } = await supabase.from('blueprint_transcripts').select('*').eq('session_id', sessionId).order('created_at');
  if (error) throw error;
  return (data || []).map(dbToBpFdeTranscript);
}

// ─── BLUEPRINTS FDE+PMP — AI Structuring (Fase 7) ────────────────────────────
// Regla no negociable (§10.1/§08): "AI puede sugerir. El FDE confirma." Por eso
// una sugerencia NUNCA escribe directo en blueprint_answers — vive en
// blueprint_ai_suggestions (PENDING/ACCEPTED/REJECTED) hasta que el FDE la
// confirma o edita, momento en el que el guardado normal (upsertBpFdeAnswer,
// siempre PM_CONFIRMED) es el único camino que toca la respuesta real. Así es
// imposible que una IA sobrescriba silenciosamente algo ya confirmado.

function dbToBpFdeSuggestion(row) {
  return { id: row.id, sessionId: row.session_id, suggestionType: row.suggestion_type, payload: row.payload, status: row.status, reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at, createdAt: row.created_at };
}

async function addBpFdeAiSuggestion(sessionId, suggestionType, payload) {
  const { data, error } = await supabase
    .from('blueprint_ai_suggestions')
    .insert({ session_id: sessionId, suggestion_type: suggestionType, payload })
    .select().single();
  if (error) throw error;
  return dbToBpFdeSuggestion(data);
}

async function resolveBpFdeAiSuggestion(suggestionId, status, userId, userRole) {
  const { data, error } = await supabase
    .from('blueprint_ai_suggestions')
    .update({ status, reviewed_by: userId, reviewed_at: nowISO() })
    .eq('id', suggestionId)
    .select().single();
  if (error) throw error;
  const suggestion = dbToBpFdeSuggestion(data);
  await addBpFdeAuditLog(suggestion.sessionId, userId, userRole, 'ai_suggestion_' + status.toLowerCase(), null, { suggestionId });
  return suggestion;
}

// ─── ATTACHMENTS ──────────────────────────────────────────────────

async function addAttachment(leadId, data, userId) {
  const { error } = await supabase.from('attachments').insert({
    id:            uuidv4(),
    lead_id:       leadId,
    name:          data.name,
    type:          data.type,
    url:           data.url,
    drive_file_id: data.driveFileId || null,
    uploaded_by:   userId,
    uploaded_at:   nowISO(),
    stage_at:      data.stageAt || null,
    description:   data.description || null,
    size:          data.size || null,
  });
  if (error) throw error;
}

async function deleteAttachment(attachmentId, leadId) {
  const { error } = await supabase.from('attachments').delete().eq('id', attachmentId).eq('lead_id', leadId);
  if (error) throw error;
}

async function getAttachmentsByLeadId(leadId) {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('lead_id', leadId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data.map(r => ({
    id: r.id, leadId: r.lead_id, name: r.name, type: r.type,
    url: r.url, driveFileId: r.drive_file_id, uploadedBy: r.uploaded_by,
    uploadedAt: r.uploaded_at, stageAt: r.stage_at,
    description: r.description, size: r.size,
  }));
}

// ─── USERS ────────────────────────────────────────────────────────

async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('active', true)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return dbToUser(data);
}

async function updateLastLogin(userId) {
  const { error } = await supabase
    .from('users')
    .update({ last_login: nowISO() })
    .eq('id', userId);
  if (error) throw error;
}

async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('active', true);
  if (error) throw error;
  return data.map(dbToUser);
}

// ─── DASHBOARD STATS ──────────────────────────────────────────────

async function getDashboardStats() {
  const leads = await getAllLeads();
  const active = leads.filter(l => !['14', '15', '16', '17', '20', 'deleted'].includes(l.stage));
  const won    = leads.filter(l => ['14', '15'].includes(l.stage));

  const levelDist = { A: 0, B: 0, C: 0, D: 0 };
  leads.forEach(l => { if (levelDist[l.level] !== undefined) levelDist[l.level]++; });

  const stageMap = {};
  leads.forEach(l => {
    if (!stageMap[l.stage]) stageMap[l.stage] = { count: 0, value: 0 };
    stageMap[l.stage].count++;
    stageMap[l.stage].value += l.valueUSD;
  });

  return {
    leadsActive:       active.length,
    pipelineValueUSD:  active.reduce((a, l) => a + l.valueUSD, 0),
    conversionRate:    leads.length ? Math.round((won.length / leads.length) * 100) : 0,
    blueprintSessions: leads.filter(l => l.flowType).length,
    slaAtRisk:         leads.filter(l => l.slaActive).length,
    levelDistribution: levelDist,
    stageDistribution: Object.entries(stageMap).map(([stage, d]) => ({ stage, ...d })),
    totalLeads:        leads.length,
  };
}

// ─── CLOSED LOST ──────────────────────────────────────────────────

async function addToClosedLost(lead, reason, category, recontact) {
  const { error } = await supabase.from('closed_lost').insert({
    id:           uuidv4(),
    lead_id:      lead.id,
    name:         lead.name,
    company:      lead.company,
    email:        lead.email,
    sector:       lead.sector,
    country:      lead.country,
    session_date: lead.blueprintSession?.sessionDate || null,
    ivc_score:    lead.ivcScore || null,
    reason:       reason || null,
    category:     category || null,
    recontact:    recontact || false,
    closed_at:    nowISO(),
  });
  if (error) throw error;
}

// ─── CONTRACTS ────────────────────────────────────────────────────

const DEFAULT_PAYMENTS = [
  { label: 'Primer Pago',     amount: 0, date: null, paid: false },
  { label: 'Segundo Pago',    amount: 0, date: null, paid: false },
  { label: 'Tercer Pago',     amount: 0, date: null, paid: false },
  { label: 'Cuarto Pago',     amount: 0, date: null, paid: false },
  { label: 'Saldo Pendiente', amount: 0, date: null, paid: false },
];

function contractFromDb(row) {
  return {
    id:             row.id,
    leadId:         row.lead_id,
    contractNumber: row.contract_number || '',
    totalValueCOP:  row.total_value_cop || 0,
    concept:        (() => { try { const p = JSON.parse(row.concept||''); return Array.isArray(p) ? p : (row.concept ? [row.concept] : []) } catch { return row.concept ? [row.concept] : [] } })(),
    payments:       row.payments || DEFAULT_PAYMENTS,
    notes:          row.notes || '',
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

async function getContract(leadId) {
  const { data, error } = await supabase.from('contracts').select('*').eq('lead_id', leadId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? contractFromDb(data) : null;
}

async function upsertContract(leadId, contractData) {
  const existing = await getContract(leadId);
  const payload = {
    contract_number: contractData.contractNumber || '',
    total_value_cop: parseInt(contractData.totalValueCOP) || 0,
    concept:         Array.isArray(contractData.concept) ? JSON.stringify(contractData.concept) : (contractData.concept || ''),
    payments:        contractData.payments || DEFAULT_PAYMENTS,
    notes:           contractData.notes || '',
    updated_at:      nowISO(),
  };
  if (existing) {
    const { error } = await supabase.from('contracts').update(payload).eq('lead_id', leadId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('contracts').insert({ id: uuidv4(), lead_id: leadId, ...payload });
    if (error) throw error;
  }
  return await getContract(leadId);
}

async function getAllContracts() {
  const { data, error } = await supabase.from('contracts').select('*');
  if (error) throw error;
  return (data || []).map(contractFromDb);
}

async function getDeletedLeadEmails() {
  const { data } = await supabase.from('leads').select('email').eq('stage', 'deleted');
  return new Set((data || []).map(l => (l.email || '').toLowerCase().trim()).filter(Boolean));
}

// ─── PROJECT BOARDS ───────────────────────────────────────────────

async function getBoard(leadId) {
  const { data, error } = await supabase
    .from('project_boards')
    .select('board_data')
    .eq('lead_id', parseInt(leadId))
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.board_data || null;
}

async function upsertBoard(leadId, boardData) {
  const { data, error } = await supabase
    .from('project_boards')
    .upsert(
      { lead_id: parseInt(leadId), board_data: boardData, updated_at: new Date().toISOString() },
      { onConflict: 'lead_id' }
    )
    .select('board_data')
    .single();
  if (error) throw error;
  return data?.board_data;
}

module.exports = {
  getAllLeads, getLeadById, createLead, updateLead, updateLeadStage, deleteLead,
  getDeletedLeadEmails,
  generateLeadCode,
  addActivityLog, getActivityByLeadId,
  getBlueprintByLeadId, createBlueprint, updateBlueprint, approveBlueprint,
  createBpFdeSession, getBpFdeSessionById, getBpFdeSessionsByLead,
  updateBpFdeSession, transitionBpFdeSessionStatus, addBpFdeAuditLog,
  getBpFdeQuestionBank, getBpFdeAnswers, upsertBpFdeAnswer,
  getBpFdeVoiceConsent, setBpFdeVoiceConsent, addBpFdeTranscript, getBpFdeTranscripts,
  addBpFdeAiSuggestion, resolveBpFdeAiSuggestion,
  addAttachment, getAttachmentsByLeadId, deleteAttachment,
  getUserByEmail, updateLastLogin, getAllUsers,
  getDashboardStats, addToClosedLost,
  getContract, upsertContract, getAllContracts,
  getBoard, upsertBoard,
};
