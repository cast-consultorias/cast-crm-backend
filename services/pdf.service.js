const PDFDocument = require('pdfkit');

// ─── COLORS ──────────────────────────────────────────────────────────────────
const NAVY  = '#1C2B4A';
const GOLD  = '#C9A84C';
const BLUE  = '#007AFF';
const GRAY  = '#6E6E73';
const LGRAY = '#F2F2F7';
const WHITE = '#FFFFFF';
const GREEN = '#34C759';
const ORANGE= '#FF9500';
const RED   = '#FF3B30';
const PURPLE= '#AF52DE';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function ivcColor(score) {
  const n = parseFloat(score);
  if (n >= 1.2) return GREEN;
  if (n >= 0.5) return ORANGE;
  return RED;
}

function ivcLabel(score) {
  const n = parseFloat(score);
  if (n >= 1.2) return 'ALTA CONVERSIÓN';
  if (n >= 0.5) return 'POTENCIAL MEDIO';
  return 'RIESGO ALTO';
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r, g, b];
}

function setColor(doc, hex) {
  doc.fillColor(hex);
}

// Draw a filled rect with hex color
function rect(doc, x, y, w, h, hex) {
  doc.save().fillColor(hex).rect(x, y, w, h).fill().restore();
}

// Section header bar
function sectionBar(doc, x, y, w, title, color = NAVY) {
  rect(doc, x, y, w, 22, color);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE)
    .text(title.toUpperCase(), x + 10, y + 7, { width: w - 20 });
  return y + 22;
}

// Key-value row
function kvRow(doc, x, y, w, label, value, labelW = 140) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY)
    .text(label, x, y, { width: labelW });
  doc.font('Helvetica').fontSize(9).fillColor(NAVY)
    .text(String(value || '—'), x + labelW, y, { width: w - labelW });
  return y + 14;
}

// Paragraph text
function para(doc, x, y, w, text, opts = {}) {
  if (!text) return y;
  doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(opts.size || 9)
    .fillColor(opts.color || NAVY)
    .text(text, x, y, { width: w, lineGap: 2 });
  return doc.y + (opts.gap || 6);
}

// Page footer
function addFooter(doc, pageNum, total, leadName) {
  const y = doc.page.height - 36;
  rect(doc, 40, y - 4, doc.page.width - 80, 1, LGRAY);
  doc.font('Helvetica').fontSize(7.5).fillColor(GRAY)
    .text(`CAST Consultorías SAS · Confidencial · ${leadName}`, 40, y + 2, { width: 300 })
    .text(`Pág. ${pageNum} / ${total}`, doc.page.width - 100, y + 2, { width: 60, align: 'right' });
}

// CAST header banner
function addHeader(doc, title, subtitle) {
  rect(doc, 0, 0, doc.page.width, 56, NAVY);
  // Gold accent line
  rect(doc, 0, 56, doc.page.width, 3, GOLD);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(WHITE)
    .text('CAST Consultorías', 40, 14);
  doc.font('Helvetica').fontSize(9).fillColor(GOLD)
    .text(title, 40, 33);
  if (subtitle) {
    doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.6)')
      .text(subtitle, doc.page.width - 240, 22, { width: 200, align: 'right' });
  }
}

// ─── LEAD INFO BLOCK ─────────────────────────────────────────────────────────
function addLeadBlock(doc, lead, margin) {
  const W = doc.page.width - margin * 2;
  let y = 75;
  rect(doc, margin, y, W, 62, LGRAY);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(NAVY)
    .text(lead.name, margin + 12, y + 10, { width: W - 24 });
  doc.font('Helvetica').fontSize(9).fillColor(GRAY)
    .text(`${lead.company || '—'} · ${lead.country || '—'} · ${lead.sector || '—'}`, margin + 12, y + 27, { width: W * 0.6 });

  const levelColor = lead.level === 'A' ? GREEN : lead.level === 'B' ? BLUE : lead.level === 'C' ? ORANGE : RED;
  rect(doc, margin + W - 90, y + 10, 78, 20, levelColor);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE)
    .text(`Nivel ${lead.level}  ·  Score ${lead.score}`, margin + W - 88, y + 16, { width: 74, align: 'center' });

  doc.font('Helvetica').fontSize(8).fillColor(GRAY)
    .text(`Generado: ${new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' })}`, margin + 12, y + 45, { width: W });
  return y + 62 + 12;
}

// ─── GENERATE AI REPORT PDF ──────────────────────────────────────────────────
function generateReportPDF(lead) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 20, bottom: 50, left: 40, right: 40 }, info: { Title: `Reporte IA · ${lead.name}`, Author: 'CAST Consultorías' } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const M = 40;
    const W = doc.page.width - M * 2;

    // ── PAGE 1 ──
    addHeader(doc, 'REPORTE DE ANÁLISIS ESTRATÉGICO', `Generado por IA · ${new Date().toLocaleDateString('es-CO')}`);
    let y = addLeadBlock(doc, lead, M);

    // Parse reportContent markdown sections
    const content = lead.reportContent || '';
    const sections = [];
    const lines = content.split('\n');
    let current = null;
    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (current) sections.push(current);
        current = { title: line.replace('## ', '').trim(), body: [] };
      } else if (current) {
        current.body.push(line);
      }
    }
    if (current) sections.push(current);

    if (sections.length === 0 && content) {
      sections.push({ title: 'Análisis', body: content.split('\n') });
    }

    const sectionColors = [NAVY, BLUE, PURPLE, ORANGE, RED, GREEN];

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const bodyText = s.body.join('\n').replace(/\*\*(.*?)\*\*/g, '$1').trim();
      const approxH = 22 + Math.ceil(bodyText.length / 80) * 13 + 20;

      if (y + approxH > doc.page.height - 60) {
        doc.addPage();
        addHeader(doc, 'REPORTE DE ANÁLISIS ESTRATÉGICO', `Continuación · ${lead.name}`);
        y = 75;
      }

      y = sectionBar(doc, M, y, W, s.title, sectionColors[i % sectionColors.length]);
      y += 6;

      if (bodyText) {
        doc.font('Helvetica').fontSize(9).fillColor(NAVY)
          .text(bodyText, M + 8, y, { width: W - 16, lineGap: 3 });
        y = doc.y + 14;
      } else {
        y += 14;
      }
    }

    doc.end();
  });
}

// ─── GENERATE IVC EVALUATION PDF ─────────────────────────────────────────────
function generateIVCPDF(lead) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 20, bottom: 50, left: 40, right: 40 }, info: { Title: `Evaluación IVC · ${lead.name}`, Author: 'CAST Consultorías' } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const M = 40;
    const W = doc.page.width - M * 2;
    const s = lead.blueprintSession || {};

    // ── PAGE 1 — HEADER + IVC SCORE ──
    addHeader(doc, 'EVALUACIÓN BLUEPRINT SESSION™ · IVC', `Sesión: ${s.sessionDate || '—'} · Conducida por: ${s.conductedBy || '—'}`);
    let y = addLeadBlock(doc, lead, M);

    // IVC Score card
    const ivcVal = s.ivcCalculated || lead.ivcScore;
    const ivcC = ivcVal ? ivcColor(ivcVal) : GRAY;
    rect(doc, M, y, W, 70, NAVY);
    rect(doc, M, y + 67, W, 3, GOLD);

    doc.font('Helvetica-Bold').fontSize(10).fillColor(GOLD)
      .text('IVC · ÍNDICE DE VALOR DEL CLIENTE', M + 16, y + 10);
    doc.font('Helvetica-Bold').fontSize(36).fillColor(ivcVal ? ivcC : 'rgba(255,255,255,0.3)')
      .text(ivcVal || '—', M + 16, y + 24);
    if (ivcVal) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(ivcC)
        .text(ivcLabel(ivcVal), M + 100, y + 34);
    }

    // IVC formula components
    const comps = [
      { label: 'RS · Resultado Soñado', value: s.q7 || lead.ivcRS || 0 },
      { label: 'PP · Prob. Percibida', value: s.q10 ? ((10 - s.q10) / 10).toFixed(2) : (lead.ivcPP || 0) },
      { label: 'RT · Retraso de Tiempo', value: lead.ivcRT || 0 },
      { label: 'ES · Esfuerzo/Sacrificio', value: lead.ivcES || 0 },
    ];
    const compW = (W - 32) / 4;
    comps.forEach((c, i) => {
      const cx = M + 16 + i * (compW + 8);
      doc.font('Helvetica').fontSize(7).fillColor('rgba(255,255,255,0.55)')
        .text(c.label, cx, y + 52, { width: compW });
      doc.font('Helvetica-Bold').fontSize(11).fillColor(WHITE)
        .text(String(c.value), cx + compW - 24, y + 49, { width: 24, align: 'right' });
    });

    y += 70 + 14;

    // Tier & Flow
    rect(doc, M, y, W, 28, LGRAY);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY)
      .text('Tier Acordado:', M + 12, y + 9);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BLUE)
      .text(s.phase05TierConfirmed || s.q21Tier || '—', M + 100, y + 9);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY)
      .text('Flujo:', M + 200, y + 9);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BLUE)
      .text(s.phase05FlowConfirmed || '—', M + 232, y + 9);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY)
      .text('Blueprint:', M + 330, y + 9);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(lead.blueprintDone ? GREEN : ORANGE)
      .text(lead.blueprintDone ? 'Completada' : 'Pendiente', M + 388, y + 9);
    y += 28 + 14;

    // ─ Helper to add a Q&A block ─
    const qa = (label, value) => {
      if (y > doc.page.height - 70) {
        doc.addPage();
        addHeader(doc, 'EVALUACIÓN BLUEPRINT SESSION™ · IVC', `Continuación · ${lead.name}`);
        y = 75;
      }
      doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY)
        .text(label, M, y, { width: W * 0.38 });
      doc.font('Helvetica').fontSize(8).fillColor(NAVY)
        .text(value || '—', M + W * 0.4, y, { width: W * 0.6, lineGap: 2 });
      y = Math.max(doc.y, y) + 8;
    };

    // ── BLOQUE A — CONTEXTO DEL PROYECTO ──
    y = sectionBar(doc, M, y, W, 'Bloque A — Contexto del Proyecto', '#1C7C4A');
    y += 8;
    qa('¿Qué es tu proyecto o idea?', s.q1);
    qa('Etapa del proyecto', s.q2);
    qa('Documentos / avances disponibles', s.q3);
    qa('Sector', s.q4Sector + (s.q4International ? ' · Internacional' : ''));

    y += 4;
    y = sectionBar(doc, M, y, W, 'Bloque B — Resultado Soñado (RS)', BLUE);
    y += 8;
    qa('¿Cómo sería si funciona perfectamente?', s.q5);
    qa('Cifra cuantificada del resultado', s.q5Amount);
    qa('Impacto personal de lograrlo', s.q6);
    qa('Importancia para ti (RS 1-10)', String(s.q7 || '—'));

    y += 4;
    y = sectionBar(doc, M, y, W, 'Bloque C — Probabilidad Percibida (PP)', PURPLE);
    y += 8;
    qa('¿Por qué no has avanzado solo?', s.q8);
    qa('Tiempo sin avanzar', s.q8Time);
    qa('Intentos previos de resolución', s.q9);
    qa('Seguridad de lograrlo solo (PP 1-10)', String(s.q10 || '—'));

    y += 4;
    y = sectionBar(doc, M, y, W, 'Bloque D — Retraso de Tiempo (RT)', ORANGE);
    y += 8;
    qa('¿Para cuándo necesitas resultados?', s.q11Time);
    qa('¿Qué pasa si no resuelves en 6 meses?', s.q11);
    qa('Velocidad de avance deseada', s.q12);

    y += 4;
    y = sectionBar(doc, M, y, W, 'Bloque E — Esfuerzo y Sacrificio (ES)', GREEN);
    y += 8;
    qa('Recursos disponibles para el proyecto', s.q13);
    qa('Nivel de involucramiento deseado', s.q14);
    qa('Restricciones (tiempo / equipo / infraestructura)', s.q15);

    y += 4;
    y = sectionBar(doc, M, y, W, 'Bloque F — Miedos y Objeciones', RED);
    y += 8;
    qa('Mayor preocupación del proceso', s.q16);
    qa('Experiencia con consultores', s.q17Consultors);
    qa('¿Qué impediría la decisión?', s.q18);

    y += 4;
    y = sectionBar(doc, M, y, W, 'Bloque G — Contexto Financiero', GOLD);
    y += 8;
    qa('Tipo de capital disponible', s.q19Capital);
    qa('¿Busca financiación externa?', s.q20External ? `Sí${s.q20Detail ? ' · ' + s.q20Detail : ''}` : 'No');
    qa('Rango de inversión cómodo', s.q21Range);
    qa('Tier sugerido según inversión', s.q21Tier || '—');

    if (s.blockH) {
      y += 4;
      y = sectionBar(doc, M, y, W, 'Bloque H — Espacio Libre del Lead', GOLD);
      y += 8;
      qa('Comentarios adicionales del lead', s.blockH);
    }

    // ── CIELO E INFIERNO ──
    if (s.phase04Heaven || s.phase04Hell || s.phase04Financial) {
      y += 4;
      y = sectionBar(doc, M, y, W, 'Fase 04 — Cielo e Infierno', NAVY);
      y += 8;
      qa('Aspiraciones profundas', s.phase04Heaven);
      qa('Miedos y objeciones identificadas', s.phase04Hell);
      qa('Contexto financiero adicional', s.phase04Financial);
    }

    // ── CIERRE ──
    if (s.phase05Insights) {
      y += 4;
      y = sectionBar(doc, M, y, W, 'Fase 05 — Transición y Cierre', NAVY);
      y += 8;
      qa('Insights compartidos con el lead', s.phase05Insights);
      qa('Flujo acordado', s.phase05FlowConfirmed || '—');
      qa('Tier acordado', s.phase05TierConfirmed || '—');
      qa('50% pago inicial confirmado', s.phase05Payment50 ? 'Sí' : 'No');
    }

    doc.end();
  });
}

module.exports = { generateReportPDF, generateIVCPDF };
