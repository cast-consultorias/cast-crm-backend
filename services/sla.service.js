const cron = require('node-cron');
const axios = require('axios');
const { getAllLeads, updateLead, addActivityLog } = require('./supabase.service');
const { sendFollowUp24h } = require('./gmail.service');
require('dotenv').config();

async function fireN8NWebhook(type, lead) {
  const url = process.env.N8N_SLA_ALERT;
  if (!url) return;
  try {
    await axios.post(url, { type, lead: { id:lead.id, name:lead.name, company:lead.company, stage:lead.stage, assignee:lead.assignee, slaStartTime:lead.slaStartTime } },
      { headers: { 'x-cast-secret': process.env.N8N_WEBHOOK_SECRET }, timeout: 5000 });
  } catch (e) { console.warn('N8N webhook failed:', e.message); }
}

async function autoAdvance(lead, toStage, reason) {
  try {
    await updateLead(lead.id, { stage: toStage, slaStartTime: new Date().toISOString() }, 'system', 'Sistema', 'Auto');
    await addActivityLog(lead.id, 'system', 'Sistema', 'Auto', `Auto-avance →${toStage}`, reason, toStage);
    console.log(`[auto-advance] ${lead.name} ${lead.stage}→${toStage}`);
  } catch (e) { console.warn(`[auto-advance] Error ${lead.id}:`, e.message); }
}

function startSLAMonitor() {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const leads = await getAllLeads();
      const now   = Date.now();

      for (const lead of leads.filter(l => l.slaStartTime)) {
        const h = (now - new Date(lead.slaStartTime).getTime()) / 3600000;

        // ── SLA 48h alerts — stage 08 investigación ──────────────
        if (lead.stage === '08' && lead.slaActive) {
          if      (h >= 48) await fireN8NWebhook('SLA_CRITICAL', lead);
          else if (h >= 42) await fireN8NWebhook('SLA_URGENT',   lead);
          else if (h >= 24) await fireN8NWebhook('SLA_WARNING',  lead);
        }

        // ── Auto-avance 09 → 10 a las 48h post-entregable ────────
        if (lead.stage === '09' && h >= 48)
          await autoAdvance(lead, '10', '48h transcurridas desde envío del entregable — coordinando 2da Reunión');

        // ── Auto-avance 10 → 17 a los 8 días sin respuesta ───────
        if (lead.stage === '10' && h >= 192)
          await autoAdvance(lead, '19', '8 días sin respuesta tras propuesta — pasando a Nurturing');

        // ── Auto-avance 05 → 17 a las 72h sin agendar sesión ─────
        if (lead.stage === '05' && h >= 72)
          await autoAdvance(lead, '19', '72h en Prep. Sesión sin agendar Blueprint — pasando a Nurturing');
      }

      // ── Email follow-up 24h post entregable ──────────────────
      for (const lead of leads.filter(l => l.nextAction === 'followup_email_4' && l.nextActionDate)) {
        if (now >= new Date(lead.nextActionDate).getTime() && lead.stage === '09') {
          try {
            await sendFollowUp24h(lead);
            await addActivityLog(lead.id, 'system', 'Sistema', 'Auto', 'Email enviado', 'Email 4: Follow-up 24h automático', lead.stage);
          } catch (e) { console.error('Email 4 error:', e.message); }
          await updateLead(lead.id, { nextAction: '', nextActionDate: null }, 'system', 'Sistema', 'Auto').catch(() => {});
        }
      }

    } catch (e) { console.error('SLA monitor error:', e.message); }
  });
  console.log('✅ Monitor SLA + auto-avances activo (cada 15 min)');
}

module.exports = { startSLAMonitor };
