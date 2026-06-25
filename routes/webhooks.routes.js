const router = require('express').Router();
const svc      = require('../services/supabase.service');
const calSvc   = require('../services/calendar.service');
const gmailSvc = require('../services/gmail.service');
const driveSvc = require('../services/drive.service');
const { getLevel } = require('../services/ivc.service');
const { nowISO } = require('../utils/dateUtils');
const { bookingEmailSentLeads } = require('../utils/emailDedup');

function verifySecret(req, res) {
  const secret = req.headers['x-cast-secret'];
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// POST /api/webhooks/n8n/lead-received
router.post('/n8n/lead-received', async (req, res, next) => {
  try {
    if (!verifySecret(req, res)) return;
    const data = req.body;
    const lead = await svc.createLead({
      name:         data.name || data.nombre || 'Sin nombre',
      company:      data.company || data.empresa || '—',
      email:        data.email || '',
      phone:        data.phone || data.telefono || '',
      country:      data.country || data.pais || '🇨🇴 Colombia',
      sector:       data.sector || 'Otro',
      score:        parseInt(data.score) || 50,
      level:        getLevel(parseInt(data.score) || 50),
      stage:        '01',
      valueUSD:     parseInt(data.valueUSD) || 0,
      probability:  50,
      painType:     data.painType || '',
      projectStage: data.projectStage || '',
      source:       data.source || 'Google Forms',
      assignee:     'Carlos Suárez',
      notes:        data.notes || '',
      entryType:    'automatic',
    }, 'n8n', 'n8n Webhook', 'Sistema');

    res.json({ received: true, leadId: lead.id });
  } catch (e) { next(e); }
});

// POST /api/webhooks/n8n/report-ready
router.post('/n8n/report-ready', async (req, res, next) => {
  try {
    if (!verifySecret(req, res)) return;
    const { leadId, reportContent } = req.body;

    // 1. Marcar Reporte IA como listo y avanzar a Stage 03
    await svc.updateLead(leadId, { reportIA: true, reportContent: reportContent||'', updatedAt: nowISO() }, 'n8n', 'n8n Webhook', 'Sistema');
    await svc.updateLeadStage(leadId, '03', 'n8n', 'n8n Webhook', 'Sistema', 'Reporte IA generado automáticamente');

    // 2. Routing automático para leads de campañas masivas
    const lead = await svc.getLeadById(leadId);
    if (!lead) return res.json({ received: true });

    const CAMPAIGN_SOURCES = ['Google Forms', 'WhatsApp', 'Instagram', 'Facebook', 'LinkedIn'];
    const esCampana = lead.entryType === 'automatic' && CAMPAIGN_SOURCES.includes(lead.source);

    if (esCampana) {
      const level = (lead.level || getLevel(parseInt(lead.score) || 0)).toUpperCase();

      if (level === 'A') {
        // Fast Track → Blueprint con Carlos (CEO)
        await svc.updateLead(leadId, {
          flowType: 'Flujo 2',
          assignee: 'Carlos Suárez',
          updatedAt: nowISO(),
        }, 'n8n', 'Auto-routing', 'Sistema');
        await svc.updateLeadStage(leadId, '04', 'n8n', 'Auto-routing', 'Sistema',
          'Nivel A — Fast Track: Blueprint directo con Carlos Suárez');
        if (lead.email) {
          gmailSvc.sendBookingInvitation(lead).then(msgId => {
            console.log(`[email] Booking invitation sent OK (webhook A) to ${lead.email} — msgId: ${msgId}`);
            svc.addActivityLog(leadId, 'n8n', 'Auto-routing', 'Sistema', 'Email enviado', 'Email 00: Invitación a agendar Blueprint Session™ — enviado automáticamente', '04');
          }).catch(e => console.error(`[email] Booking invitation FAILED (webhook A) to ${lead.email}:`, e.message));
        }

      } else if (level === 'B') {
        // Blueprint con Coordinadora
        await svc.updateLead(leadId, {
          flowType: 'Flujo 2',
          assignee: 'Eusimary Contreras',
          updatedAt: nowISO(),
        }, 'n8n', 'Auto-routing', 'Sistema');
        await svc.updateLeadStage(leadId, '04', 'n8n', 'Auto-routing', 'Sistema',
          'Nivel B — Blueprint con Coordinadora (Eusimary Contreras)');
        if (lead.email) {
          gmailSvc.sendBookingInvitation(lead).then(msgId => {
            console.log(`[email] Booking invitation sent OK (webhook B) to ${lead.email} — msgId: ${msgId}`);
            svc.addActivityLog(leadId, 'n8n', 'Auto-routing', 'Sistema', 'Email enviado', 'Email 00: Invitación a agendar Blueprint Session™ — enviado automáticamente', '04');
          }).catch(e => console.error(`[email] Booking invitation FAILED (webhook B) to ${lead.email}:`, e.message));
        }

      } else if (level === 'C') {
        // Nurturing
        await svc.updateLeadStage(leadId, '17', 'n8n', 'Auto-routing', 'Sistema',
          'Nivel C — Ingresa a secuencia de Nurturing');

      } else {
        // D — No califica → Closed Lost automático
        await svc.updateLead(leadId, {
          closedLostReason:   'Score < 44 en scoring de campaña masiva',
          closedLostCategory: 'No Califica — Score Insuficiente',
          updatedAt: nowISO(),
        }, 'n8n', 'Auto-routing', 'Sistema');
        await svc.updateLeadStage(leadId, '18', 'n8n', 'Auto-routing', 'Sistema',
          'Nivel D — No califica: Closed Lost automático');
        if (lead.driveFolderId) driveSvc.moveLeadFolder(lead.driveFolderId, 'closed-lost').catch(() => {});
      }
    }

    res.json({ received: true, routed: esCampana ? lead.level : null });
  } catch (e) { next(e); }
});

// POST /api/webhooks/calcom/booking-created
router.post('/calcom/booking-created', async (req, res, next) => {
  try {
    console.log('[calcom-webhook] raw body:', JSON.stringify(req.body, null, 2));
    const payload  = req.body?.payload || req.body;
    const attendee = payload.attendees?.[0] || payload.attendee;
    console.log('[calcom-webhook] parsed — leadId:', payload.metadata?.leadId, '| attendee email:', attendee?.email);

    // Try leadId from metadata first, then fall back to attendee email
    let lead = null;
    const leadId = payload.metadata?.leadId || payload.description?.match(/leadId:(\S+)/)?.[1];
    if (leadId) {
      lead = await svc.getLeadById(leadId);
    }
    if (!lead && attendee?.email) {
      const allLeads = await svc.getAllLeads();
      lead = allLeads.find(l => l.email?.toLowerCase() === attendee.email.toLowerCase()) || null;
    }
    if (!lead) return res.json({ received: true, note: 'Lead not found' });

    const startTime = payload.startTime;
    // Convert UTC to America/Bogota (UTC-5) for display in emails and stage log
    const startDate = startTime ? new Date(startTime) : null;
    const date = startDate ? startDate.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) : null;
    const time = startDate ? startDate.toLocaleTimeString('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' }) : null;
    let meetLink = payload.videoCallData?.url || payload.metadata?.videoCallUrl || '';

    if (date && time) {
      // Si cal.com no provee Meet link, crear el evento en Google Calendar desde el CRM
      if (!meetLink) {
        try {
          const event = await calSvc.createBlueprintSessionEvent(lead, date, time, 120);
          meetLink = event.meetLink || '';
          console.log(`Google Calendar event created for lead ${lead.id}: ${event.eventId}`);
        } catch (e) {
          console.warn('Google Calendar event creation failed:', e.message);
        }
      }

      // Clear dedup guard so re-entering 04 (e.g. on cancellation) re-sends the invitation
      bookingEmailSentLeads.delete(lead.id);

      await svc.updateLeadStage(lead.id, '05', 'calcom', 'Cal.com', 'Sistema', `Sesión agendada via cal.com: ${date} ${time}`);
      await svc.addActivityLog(lead.id, 'calcom', 'Cal.com', 'Sistema', 'Sesión agendada', `Blueprint Session agendada: ${date} ${time} · Meet: ${meetLink}`, '05');

      // Auto-send session confirmation email
      if (lead.email) {
        gmailSvc.sendSessionConfirmed(lead, date, time, meetLink)
          .then(msgId => {
            console.log(`[email] Session confirmed sent OK to ${lead.email} — msgId: ${msgId}`);
            svc.addActivityLog(lead.id, 'calcom', 'Cal.com', 'Sistema', 'Email enviado', `Email 1: Sesión confirmada (${date} ${time}) — enviado automáticamente`, '05');
          })
          .catch(e => console.error(`[email] Session confirmed FAILED to ${lead.email}:`, e.message));
      }
    }

    res.json({ received: true, leadId: lead.id });
  } catch (e) { next(e); }
});

// POST /api/webhooks/calcom/booking-cancelled
router.post('/calcom/booking-cancelled', async (req, res, next) => {
  try {
    const payload  = req.body?.payload || req.body;
    const attendee = payload.attendees?.[0] || payload.attendee;

    let lead = null;
    const leadId = payload.metadata?.leadId || payload.description?.match(/leadId:(\S+)/)?.[1];
    if (leadId) {
      lead = await svc.getLeadById(leadId);
    }
    if (!lead && attendee?.email) {
      const allLeads = await svc.getAllLeads();
      lead = allLeads.find(l => l.email?.toLowerCase() === attendee.email.toLowerCase()) || null;
    }
    if (!lead) return res.json({ received: true, note: 'Lead not found' });

    await svc.updateLeadStage(lead.id, '04', 'calcom', 'Cal.com', 'Sistema',
      `Sesión cancelada via cal.com — regresa a Etapa 04`);

    res.json({ received: true, leadId: lead.id });
  } catch (e) { next(e); }
});

// POST /api/webhooks/sync-external-leads
// Importa leads desde los sheets externos (scoring dashboard + formulario)
// Trigger: manual via n8n, Postman, o botón en el CRM
router.post('/sync-external-leads', async (req, res, next) => {
  try {
    if (!verifySecret(req, res)) return;
    const { syncExternalLeads } = require('../services/externalLeads.service');
    const results = await syncExternalLeads();
    res.json({ success: true, ...results });
  } catch (e) { next(e); }
});

// POST /api/webhooks/recover-missing-leads
// Recupera leads que quedaron marcados "En CRM" en el scoring sheet pero no llegaron a Supabase
router.post('/recover-missing-leads', async (req, res, next) => {
  try {
    if (!verifySecret(req, res)) return;
    const { recoverMissingLeads } = require('../services/externalLeads.service');
    const results = await recoverMissingLeads();
    res.json({ success: true, ...results });
  } catch (e) { next(e); }
});

// GET /api/webhooks/health
router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: nowISO(), service: 'CAST CRM Webhooks' }));

module.exports = router;
