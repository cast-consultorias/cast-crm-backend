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

function startSLAMonitor() {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const leads = await getAllLeads();
      const now   = Date.now();

      // ── SLA 48h alerts (stage 08 investigation) ──────────────
      for (const lead of leads.filter(l => l.slaActive && l.slaStartTime)) {
        const hoursElapsed = (now - new Date(lead.slaStartTime).getTime()) / 3600000;
        if      (hoursElapsed >= 48) { await fireN8NWebhook('SLA_CRITICAL', lead); }
        else if (hoursElapsed >= 42) { await fireN8NWebhook('SLA_URGENT',  lead); }
        else if (hoursElapsed >= 24) { await fireN8NWebhook('SLA_WARNING', lead); }
      }

      // ── Auto-avance 09 → 10 a las 48h post-entregable ────────
      for (const lead of leads.filter(l => l.stage === '09' && l.slaStartTime)) {
        const hoursElapsed = (now - new Date(lead.slaStartTime).getTime()) / 3600000;
        if (hoursElapsed >= 48) {
          try {
            await updateLead(lead.id, { stage: '10', slaStartTime: null }, 'system', 'Sistema', 'Auto');
            await addActivityLog(lead.id, 'system', 'Sistema', 'Auto',
              'Auto-avance 09→10', '48h transcurridas desde envío del entregable — coordinando 2da Reunión', '10');
            console.log(`[auto-advance] Lead ${lead.id} (${lead.name}) movido 09→10 tras 48h`);
          } catch (e) { console.warn(`[auto-advance] Error moviendo lead ${lead.id}:`, e.message); }
        }
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
