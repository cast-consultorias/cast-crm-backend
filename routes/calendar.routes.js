const router   = require('express').Router();
const auth     = require('../middleware/auth');
const svc      = require('../services/supabase.service');
const calSvc   = require('../services/calendar.service');
const gmailSvc = require('../services/gmail.service');

// GET /api/calendar/availability
router.get('/availability', auth, async (req, res, next) => {
  try {
    const days  = parseInt(req.query.days) || 14;
    const slots = await calSvc.getAvailableSlots(days);
    res.json({ slots, timezone: 'America/Bogota' });
  } catch (e) { next(e); }
});

// POST /api/calendar/blueprint-session
router.post('/blueprint-session', auth, async (req, res, next) => {
  try {
    const { leadId, date, time, durationMinutes = 120 } = req.body;
    if (!leadId || !date || !time) return res.status(400).json({ error: 'leadId, date y time son requeridos' });

    const lead = await svc.getLeadById(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const event = await calSvc.createBlueprintSessionEvent(lead, date, time, durationMinutes);

    // Advance lead to stage 05
    await svc.updateLeadStage(leadId, '05', req.user.userId, req.user.name, req.user.role, `Sesión agendada para ${date} ${time}`);

    // Send confirmation email
    let emailSent = false;
    try {
      await gmailSvc.sendSessionConfirmed(lead, date, time, event.meetLink);
      emailSent = true;
      await svc.addActivityLog(leadId, req.user.userId, req.user.name, req.user.role, 'Sesión agendada', `${date} ${time} · Meet: ${event.meetLink}`, '05');
    } catch (e) { console.warn('Email confirmation failed:', e.message); }

    res.json({ event, emailSent });
  } catch (e) { next(e); }
});

// GET /api/calendar/upcoming
router.get('/upcoming', auth, async (req, res, next) => {
  try {
    const days    = parseInt(req.query.days) || 30;
    const events  = await calSvc.getUpcomingBlueprintSessions(days);
    res.json({ events });
  } catch (e) { next(e); }
});

// POST /api/calendar/block
router.post('/block', auth, async (req, res, next) => {
  try {
    const { date, startTime, endTime, reason } = req.body;
    if (!date || !startTime || !endTime) return res.status(400).json({ error: 'date, startTime y endTime son requeridos' });
    const event = await calSvc.createBlockEvent(date, startTime, endTime, reason || '', req.user.name || req.user.userId);
    res.json({ event });
  } catch (e) { next(e); }
});

// GET /api/calendar/blocks
router.get('/blocks', auth, async (req, res, next) => {
  try {
    const days   = parseInt(req.query.days) || 30;
    const blocks = await calSvc.getUpcomingBlocks(days);
    res.json({ blocks });
  } catch (e) { next(e); }
});

// DELETE /api/calendar/blocks/:eventId
router.delete('/blocks/:eventId', auth, async (req, res, next) => {
  try {
    await calSvc.deleteBlockEvent(req.params.eventId);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// DELETE /api/calendar/:eventId
router.delete('/:eventId', auth, async (req, res, next) => {
  try {
    await calSvc.deleteBlueprintSessionEvent(req.params.eventId);
    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
