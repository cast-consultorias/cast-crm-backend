const router = require('express').Router();
const auth   = require('../middleware/auth');
const svc    = require('../services/sheets.service');
const gmail  = require('../services/gmail.service');
const { addHours } = require('../utils/dateUtils');

async function getLead(id, res) {
  const lead = await svc.getLeadById(id);
  if (!lead) { res.status(404).json({ error: 'Lead no encontrado' }); return null; }
  return lead;
}

// POST /api/emails/booking-invitation
router.post('/booking-invitation', auth, async (req, res, next) => {
  try {
    const { leadId } = req.body;
    const lead = await getLead(leadId, res); if (!lead) return;
    const msgId = await gmail.sendBookingInvitation(lead);
    await svc.addActivityLog(leadId, req.user.userId, req.user.name, req.user.role, 'Email enviado', 'Email 00: Invitación a agendar Blueprint (reenvío)', lead.stage);
    res.json({ success: true, messageId: msgId });
  } catch (e) { next(e); }
});

// POST /api/emails/session-confirmed
router.post('/session-confirmed', auth, async (req, res, next) => {
  try {
    const { leadId, sessionDate, sessionTime, meetLink } = req.body;
    const lead = await getLead(leadId, res); if (!lead) return;
    const msgId = await gmail.sendSessionConfirmed(lead, sessionDate, sessionTime, meetLink);
    await svc.addActivityLog(leadId, req.user.userId, req.user.name, req.user.role, 'Email enviado', `Email 1: Sesión confirmada (${sessionDate})`, lead.stage);
    res.json({ success: true, messageId: msgId });
  } catch (e) { next(e); }
});

// POST /api/emails/deliverable-building
router.post('/deliverable-building', auth, async (req, res, next) => {
  try {
    const { leadId, deliveryDate } = req.body;
    const lead = await getLead(leadId, res); if (!lead) return;
    const msgId = await gmail.sendBuildingDeliverable(lead, deliveryDate);
    await svc.addActivityLog(leadId, req.user.userId, req.user.name, req.user.role, 'Email enviado', `Email 2: Entregable en construcción`, lead.stage);
    res.json({ success: true, messageId: msgId });
  } catch (e) { next(e); }
});

// POST /api/emails/deliverable-sent
router.post('/deliverable-sent', auth, async (req, res, next) => {
  try {
    const { leadId, pdfUrl, loomUrl } = req.body;
    const lead = await getLead(leadId, res); if (!lead) return;
    const msgId = await gmail.sendDeliverableSent(lead, pdfUrl, loomUrl, lead.tier);
    await svc.addActivityLog(leadId, req.user.userId, req.user.name, req.user.role, 'Email enviado', `Email 3: Entregable enviado`, lead.stage);
    // Persiste el follow-up en el lead — el cron del SLA lo ejecuta en 24h
    await svc.updateLead(leadId, {
      nextAction:     'followup_email_4',
      nextActionDate: addHours(24),
    }, req.user.userId, req.user.name, req.user.role);
    res.json({ success: true, messageId: msgId });
  } catch (e) { next(e); }
});

// POST /api/emails/nurturing/:emailNumber
router.post('/nurturing/:emailNumber', auth, async (req, res, next) => {
  try {
    const { leadId, contentBlock } = req.body;
    const lead = await getLead(leadId, res); if (!lead) return;
    const msgId = await gmail.sendNurturing(lead, req.params.emailNumber, contentBlock);
    await svc.addActivityLog(leadId, req.user.userId, req.user.name, req.user.role, 'Email enviado', `Email Nurturing #${req.params.emailNumber}`, lead.stage);
    res.json({ success: true, messageId: msgId });
  } catch (e) { next(e); }
});

// GET /api/emails/history/:leadId
router.get('/history/:leadId', auth, async (req, res, next) => {
  try {
    const activity = await svc.getActivityByLeadId(req.params.leadId);
    const emails   = activity.filter(e => e.action === 'Email enviado');
    res.json({ emails });
  } catch (e) { next(e); }
});

module.exports = router;
