const { getGmail } = require('../config/google');
require('dotenv').config();

const FROM_NAME       = process.env.GMAIL_SENDER_NAME   || 'Carlos Suárez Tous · CAST Consultorías';
const FROM_EMAIL      = process.env.GMAIL_SENDER        || 'carlos@castconsultorias.com';
const LOGO_URL        = process.env.LOGO_URL            || '';
const CALCOM_BOOK_URL = process.env.CALCOM_BOOKING_URL  || 'https://cal.com/castconsultorias/blueprint-session';

function buildEmail(to, subject, htmlBody, replyTo = FROM_EMAIL) {
  const boundary = `cast_${Date.now()}`;
  const encodedFromName = `=?UTF-8?B?${Buffer.from(FROM_NAME).toString('base64')}?=`;
  const raw = [
    `From: ${encodedFromName} <${FROM_EMAIL}>`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody).toString('base64'),
    `--${boundary}--`,
  ].join('\r\n');
  return Buffer.from(raw).toString('base64url');
}

async function sendEmail({ to, subject, htmlBody, replyTo }) {
  const gmail = await getGmail();
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: buildEmail(to, subject, htmlBody, replyTo) },
  });
  return res.data.id;
}

const logoHtml = LOGO_URL
  ? `<img src="${LOGO_URL}" alt="CAST Consultorías" style="height:48px;max-height:48px;display:block;border:0;" />`
  : `<table cellpadding="0" cellspacing="0" style="border:2px solid #C9A84C;border-radius:6px;"><tr><td style="padding:6px 14px;"><span style="color:#C9A84C;font-weight:800;font-size:18px;letter-spacing:3px;font-family:Arial,sans-serif;">CAST</span></td></tr></table>`;

function wrapTemplate(subject, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;">
  <tr><td align="center" style="padding:32px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

      <!-- HEADER -->
      <tr>
        <td style="background:linear-gradient(135deg,#1C2B4A 0%,#2D3D5A 100%);padding:28px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">${logoHtml}</td>
              <td align="right" style="vertical-align:middle;">
                <span style="color:#D4AF6A;font-style:italic;font-size:13px;">De la Idea al Impacto Real</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="background:#FFFFFF;padding:40px;">${bodyHtml}</td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#F8F9FA;padding:28px 40px;border-top:1px solid #E5E5EA;">
          <p style="font-size:15px;font-weight:700;color:#1C2B4A;margin:0 0 4px;">Carlos Suárez Tous · PMP®</p>
          <p style="font-size:13px;color:#636366;margin:0 0 12px;">CEO &amp; Fundador · CAST Consultorías SAS</p>
          <p style="font-size:13px;color:#636366;margin:0 0 4px;">📍 Barranquilla · Zúrich · Miami</p>
          <p style="font-size:13px;color:#636366;margin:0 0 4px;">📧 carlos@castconsultorias.com</p>
          <p style="font-size:13px;color:#636366;margin:0 0 14px;">🌐 www.castconsultorias.com</p>
          <p style="font-size:13px;font-style:italic;color:#8E8E93;border-left:3px solid #C9A84C;padding-left:12px;margin:0;">"No vendemos consultoría. Construimos el futuro."</p>
        </td>
      </tr>

    </table>
    <p style="margin:16px 0 0;font-size:11px;color:#AEAEB2;text-align:center;">Este mensaje es confidencial y de uso exclusivo del destinatario.</p>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── EMAIL 00 — Invitación a Agendar (Etapa 04) ──────────────────────────────
async function sendBookingInvitation(lead) {
  const subject = `${lead.name}, agenda tu Blueprint Session™ 📅`;
  const body = `
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 18px;">${lead.name}, me alegra que hayas llegado a este punto.</p>
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 18px;">El siguiente paso es agendar tu <strong>Blueprint Session™</strong> — una conversación de 120 minutos en la que vamos a analizar tu proyecto en profundidad, sin prisas y sin guiones.</p>
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 28px;">Elige la fecha y hora que mejor se adapte a tu agenda:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
  <tr>
    <td align="center">
      <a href="${CALCOM_BOOK_URL}" style="display:inline-block;background:#007AFF;color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 36px;border-radius:12px;letter-spacing:0.3px;">📅 Agendar mi sesión</a>
    </td>
  </tr>
</table>
<div style="background:#F2F2F7;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
  <p style="font-size:14px;color:#3A3A3C;margin:0 0 8px;">🕐 <strong>Duración:</strong> 120 minutos</p>
  <p style="font-size:14px;color:#3A3A3C;margin:0 0 8px;">👤 <strong>Formato:</strong> 1 a 1 con Carlos Suárez Tous</p>
  <p style="font-size:14px;color:#3A3A3C;margin:0;">🎥 <strong>Modalidad:</strong> Google Meet (recibirás el enlace al confirmar)</p>
</div>
<p style="font-size:14px;color:#8E8E93;line-height:1.7;margin:0 0 24px;">Cuando elijas tu horario, recibirás automáticamente el enlace de Google Meet y todos los detalles de confirmación.</p>
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0;">Cualquier pregunta, responde directamente a este correo.</p>`;
  return sendEmail({ to: lead.email, subject, htmlBody: wrapTemplate(subject, body) });
}

// ─── EMAIL 01 — Sesión Blueprint Confirmada ───────────────────────────────────
async function sendSessionConfirmed(lead, sessionDate, sessionTime, meetLink, durationMinutes = 120) {
  const subject = `Tu Blueprint Session está confirmada, ${lead.name} 🎯`;
  const body = `
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 18px;">${lead.name}, me alegra mucho que hayamos podido coordinar este espacio.</p>
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 18px;">En los próximos <strong>${durationMinutes} minutos</strong> vamos a hacer algo que pocas veces ocurre: vamos a sentarnos juntos a entender tu proyecto en profundidad — sin prisas, sin guiones, sin ventas.</p>
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 28px;">Mi único objetivo en esa sesión es entenderte tan bien que el análisis que te entregue después realmente cambie la dirección de lo que estás construyendo.</p>
<div style="background:#F2F2F7;border-radius:12px;padding:22px 24px;margin:0 0 28px;">
  <p style="font-size:14.5px;color:#1C1C1E;margin:0 0 10px;">📅 <strong>Fecha:</strong> ${sessionDate}</p>
  <p style="font-size:14.5px;color:#1C1C1E;margin:0 0 10px;">⏰ <strong>Hora:</strong> ${sessionTime} · Colombia (UTC-5)</p>
  <p style="font-size:14.5px;color:#1C1C1E;margin:0;">🔗 <strong>Enlace Google Meet:</strong> <a href="${meetLink}" style="color:#007AFF;text-decoration:none;font-weight:500;word-break:break-all;">${meetLink}</a></p>
</div>
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 24px;">Si necesitas mover la hora o tienes algo que quieras compartirme antes — documentos, ideas, contexto — escríbeme directamente aquí o a <a href="mailto:carlos@castconsultorias.com" style="color:#007AFF;text-decoration:none;">carlos@castconsultorias.com</a></p>
<p style="font-size:16px;font-weight:700;color:#1C2B4A;margin:0;">Nos vemos pronto.</p>`;
  return sendEmail({ to: lead.email, subject, htmlBody: wrapTemplate(subject, body) });
}

// ─── EMAIL 02 — Entregable en Construcción ────────────────────────────────────
async function sendBuildingDeliverable(lead, deliveryDate, sessionMinutes = 120) {
  const subject = `Ya estamos trabajando en tu análisis, ${lead.name}`;
  const body = `
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 18px;">${lead.name}, gracias por la sesión de hoy.</p>
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 18px;">Fueron <strong>${sessionMinutes} minutos</strong> en los que escuché con atención todo lo que estás construyendo — y te puedo decir que hay mucho potencial real en lo que compartes.</p>
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 18px;">A partir de este momento el equipo CAST entra en modo de trabajo profundo. Durante las próximas 48 horas vamos a investigar, analizar y estructurar todo lo que necesitas saber para tomar las mejores decisiones sobre tu proyecto.</p>
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 24px;">Lo que recibirás no es un documento genérico. Es un análisis hecho exclusivamente para ti, con tu contexto, tu sector y tu visión.</p>
<div style="background:#E3FAEC;border-left:4px solid #34C759;border-radius:0 10px 10px 0;padding:20px 24px;margin:0 0 24px;">
  <p style="font-size:14.5px;color:#1C1C1E;margin:0 0 10px;">⏱️ <strong>Entrega estimada:</strong> ${deliveryDate}</p>
  <p style="font-size:14.5px;color:#1C1C1E;margin:0;">📧 <strong>Lo recibirás en:</strong> ${lead.email}</p>
</div>
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0;">Si mientras tanto recuerdas algo importante que quieras agregar — no dudes en escribirme.</p>`;
  return sendEmail({ to: lead.email, subject, htmlBody: wrapTemplate(subject, body) });
}

// ─── EMAIL 03 — Entregable Enviado ────────────────────────────────────────────
async function sendDeliverableSent(lead, pdfUrl, loomUrl, tier) {
  const docName = tier === 'Premium' ? 'Diagnóstico Estratégico Premium'
                : tier === 'Pro'     ? 'Informe Ejecutivo Pro'
                :                     'Informe Ejecutivo';
  const subject = `Tu ${docName} CAST está listo, ${lead.name} ✅`;
  const body = `
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 18px;">${lead.name}, como prometido.</p>
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 18px;">Adjunto encontrarás tu <strong>${docName} CAST Blueprint Session™</strong> — un documento preparado con el mismo rigor y estándar con el que CAST trabaja con empresas e inversionistas en Colombia, Europa y Norteamérica.</p>
<div style="background:#F2F2F7;border-radius:12px;padding:22px 24px;margin:0 0 24px;">
  <p style="font-size:15px;font-weight:600;color:#1C2B4A;margin:0 0 14px;">Dentro encontrarás:</p>
  <p style="font-size:14.5px;color:#3A3A3C;margin:0 0 8px;">→ Un análisis honesto de tu proyecto</p>
  <p style="font-size:14.5px;color:#3A3A3C;margin:0 0 8px;">→ Las oportunidades reales que identificamos</p>
  <p style="font-size:14.5px;color:#3A3A3C;margin:0 0 8px;">→ Los riesgos que debes conocer antes de avanzar</p>
  <p style="font-size:14.5px;color:#3A3A3C;margin:0;">→ Una hoja de ruta clara con próximos pasos</p>
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
  <tr>
    ${pdfUrl  ? `<td align="center" style="padding-right:8px;"><a href="${pdfUrl}"  style="display:inline-block;background:#007AFF;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:10px;">📄 Ver documento</a></td>` : ''}
    ${loomUrl ? `<td align="center" style="padding-left:8px;"> <a href="${loomUrl}" style="display:inline-block;background:#1C2B4A;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:10px;">🎥 Ver video explicativo</a></td>` : ''}
  </tr>
</table>
${loomUrl ? `<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 18px;">🎥 Además, grabé un video corto donde te explico personalmente los puntos más importantes.</p>` : ''}
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0;">Tómate el tiempo que necesites para revisarlo. Mañana me pondré en contacto para escuchar tus impresiones y responder cualquier pregunta.</p>`;
  return sendEmail({ to: lead.email, subject, htmlBody: wrapTemplate(subject, body) });
}

// ─── EMAIL 04 — Follow-up 24h Post-Entregable ─────────────────────────────────
async function sendFollowUp24h(lead) {
  const subject = `¿Qué fue lo que más te impactó, ${lead.name}?`;
  const body = `
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 18px;">${lead.name}, ayer te envié el análisis de tu proyecto.</p>
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 18px;">Solo quería asegurarme de que llegó bien y preguntarte — ¿qué fue lo que más resonó contigo?</p>
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 24px;">Estoy disponible para una llamada corta hoy o mañana si quieres conversarlo. Sin agenda — solo quiero escuchar tu perspectiva después de haberlo leído.</p>
<div style="background:#F2F2F7;border-left:4px solid #C9A84C;border-radius:0 12px 12px 0;padding:24px 28px;margin:0 0 8px;">
  <p style="font-size:20px;font-weight:700;color:#1C2B4A;margin:0;line-height:1.3;">¿Cuándo tienes 20 minutos?</p>
</div>`;
  return sendEmail({ to: lead.email, subject, htmlBody: wrapTemplate(subject, body) });
}

// ─── EMAIL 05 — Nurturing ─────────────────────────────────────────────────────
async function sendNurturing(lead, emailNumber, contentBlock) {
  const subject = `Algo que encontré y pensé en ti, ${lead.name}`;
  const body = `
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 18px;">${lead.name}, hace unos días tuvimos contacto y quedé pensando en tu proyecto.</p>
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 18px;">Encontré algo relacionado con el sector <strong>${lead.sector}</strong> que creo que puede ser relevante para lo que estás construyendo.</p>
<div style="background:#F2F2F7;border-radius:12px;padding:22px 24px;margin:0 0 24px;">
  <p style="font-size:14.5px;line-height:1.75;color:#3A3A3C;margin:0;">${contentBlock || 'Contenido de valor para el sector ' + lead.sector + '.'}</p>
</div>
<p style="font-size:15px;line-height:1.7;color:#3A3A3C;margin:0 0 20px;">No hay ningún compromiso en esto — solo quería compartirlo porque genuinamente creo que te puede servir.</p>
<p style="font-size:16px;font-weight:700;color:#1C2B4A;margin:0;">Cuando sientas que es el momento de dar el siguiente paso, aquí estamos.</p>`;
  return sendEmail({ to: lead.email, subject, htmlBody: wrapTemplate(subject, body) });
}

module.exports = { sendEmail, sendBookingInvitation, sendSessionConfirmed, sendBuildingDeliverable, sendDeliverableSent, sendFollowUp24h, sendNurturing };
