const { getCalendar } = require('../config/google');
require('dotenv').config();

const CALENDAR_ID = process.env.CALENDAR_ID || 'carlos@castconsultorias.com';

const LEVEL_COLORS = { A: '2', B: '1', C: '5', D: '4' }; // Google Calendar color IDs

function buildEventDescription(lead) {
  return `
═══════════════════════════════════════
CAST BLUEPRINT SESSION™
═══════════════════════════════════════

👤 LEAD: ${lead.name}
🏢 EMPRESA: ${lead.company}
📧 EMAIL: ${lead.email}
📱 TELÉFONO: ${lead.phone}
🌍 PAÍS: ${lead.country}
🔧 SECTOR: ${lead.sector}
📊 SCORE: ${lead.score} · NIVEL ${lead.level}
💰 VALOR ESTIMADO: $${(lead.valueUSD || 0).toLocaleString()} USD
📥 FUENTE: ${lead.source}
🤝 ASIGNADO: ${lead.assignee}

═══════════════════════════════════════
TIPO DE DOLOR: ${lead.painType}
ETAPA PROYECTO: ${lead.projectStage}
NOTAS: ${lead.notes || 'Sin notas'}

🔗 Reporte IA: ${lead.reportIA ? '✅ Disponible' : '❌ No generado'}
═══════════════════════════════════════

PREPARACIÓN:
• Revisar el Reporte IA antes de la sesión
• Llevar guía de 21 preguntas IVC en el CRM
• Objetivo: IVC calculado + Tier definido + Flujo confirmado
  `.trim();
}

async function createBlueprintSessionEvent(lead, sessionDate, sessionTime, durationMinutes = 120) {
  const calendar = await getCalendar();

  const startDateTime = new Date(`${sessionDate}T${sessionTime}:00`).toISOString();
  const endDateTime   = new Date(new Date(`${sessionDate}T${sessionTime}:00`).getTime() + durationMinutes * 60000).toISOString();

  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    conferenceDataVersion: 1,
    requestBody: {
      summary:     `Blueprint Session™ · ${lead.name} · ${lead.company}`,
      description: buildEventDescription(lead),
      start: { dateTime: startDateTime, timeZone: 'America/Bogota' },
      end:   { dateTime: endDateTime,   timeZone: 'America/Bogota' },
      colorId: LEVEL_COLORS[lead.level] || '1',
      conferenceData: { createRequest: { requestId: `cast-${lead.id}-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }, { method: 'email', minutes: 1440 }] },
      attendees: [{ email: CALENDAR_ID, organizer: true }],
    },
  });

  const event    = res.data;
  const meetLink = event.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || '';

  return { eventId: event.id, meetLink, htmlLink: event.htmlLink, startDateTime, endDateTime };
}

async function getUpcomingBlueprintSessions(daysAhead = 30) {
  const calendar = await getCalendar();
  const now      = new Date();
  const future   = new Date(now.getTime() + daysAhead * 24 * 3600 * 1000);

  const res = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin:    now.toISOString(),
    timeMax:    future.toISOString(),
    q:          'Blueprint Session',
    singleEvents: true,
    orderBy:    'startTime',
  });
  return res.data.items || [];
}

async function deleteBlueprintSessionEvent(eventId) {
  const calendar = await getCalendar();
  await calendar.events.delete({ calendarId: CALENDAR_ID, eventId });
}

async function createBlockEvent(date, startTime, endTime, reason, createdBy) {
  const calendar = await getCalendar();

  const start = new Date(`${date}T${startTime}:00-05:00`).toISOString();
  const end   = new Date(`${date}T${endTime}:00-05:00`).toISOString();

  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary:      `🔒 Bloqueado · ${reason || 'Sin disponibilidad'}`,
      description:  `Bloqueado por: ${createdBy}\nMotivo: ${reason || 'N/A'}`,
      start:        { dateTime: start, timeZone: 'America/Bogota' },
      end:          { dateTime: end,   timeZone: 'America/Bogota' },
      colorId:      '8',
      transparency: 'opaque',
      visibility:   'private',
    },
  });

  return { eventId: res.data.id, htmlLink: res.data.htmlLink };
}

async function getUpcomingBlocks(daysAhead = 30) {
  const calendar = await getCalendar();
  const now    = new Date();
  const future = new Date(now.getTime() + daysAhead * 24 * 3600 * 1000);

  const res = await calendar.events.list({
    calendarId:   CALENDAR_ID,
    timeMin:      now.toISOString(),
    timeMax:      future.toISOString(),
    q:            'Bloqueado',
    singleEvents: true,
    orderBy:      'startTime',
  });
  return res.data.items || [];
}

async function deleteBlockEvent(eventId) {
  const calendar = await getCalendar();
  await calendar.events.delete({ calendarId: CALENDAR_ID, eventId });
}

async function getAvailableSlots(daysAhead = 14) {
  const WORK_START    = 9;   // 9am Colombia
  const WORK_END      = 17;  // 5pm Colombia
  const SESSION_HOURS = 2;
  const MIN_ADVANCE_H = 48;

  const now         = new Date();
  const minBookTime = new Date(now.getTime() + MIN_ADVANCE_H * 3600 * 1000);
  const rangeEnd    = new Date(now.getTime() + daysAhead * 24 * 3600 * 1000);

  const cal = await getCalendar();
  const { data } = await cal.freebusy.query({
    requestBody: {
      timeMin:  now.toISOString(),
      timeMax:  rangeEnd.toISOString(),
      timeZone: 'America/Bogota',
      items:    [{ id: CALENDAR_ID }],
    },
  });
  const busy = data.calendars[CALENDAR_ID]?.busy || [];

  const results = [];

  for (let d = 0; d < daysAhead; d++) {
    const dayUTC = new Date(now);
    dayUTC.setUTCDate(dayUTC.getUTCDate() + d);

    // Date string in Colombia timezone (UTC-5)
    const dateStr = dayUTC.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const weekday = dayUTC.toLocaleDateString('en-US', { timeZone: 'America/Bogota', weekday: 'long' });
    if (weekday === 'Saturday' || weekday === 'Sunday') continue;

    const times = [];
    for (let h = WORK_START; h + SESSION_HOURS <= WORK_END; h++) {
      const slotStart = new Date(`${dateStr}T${String(h).padStart(2,'0')}:00:00-05:00`);
      const slotEnd   = new Date(slotStart.getTime() + SESSION_HOURS * 3600 * 1000);

      if (slotStart < minBookTime) continue;

      const conflict = busy.some(b => slotStart < new Date(b.end) && slotEnd > new Date(b.start));
      if (!conflict) times.push(`${String(h).padStart(2,'0')}:00`);
    }

    if (times.length > 0) results.push({ date: dateStr, times });
  }

  return results;
}

module.exports = { createBlueprintSessionEvent, getUpcomingBlueprintSessions, deleteBlueprintSessionEvent, getAvailableSlots, createBlockEvent, getUpcomingBlocks, deleteBlockEvent };
