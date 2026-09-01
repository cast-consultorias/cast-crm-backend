const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateLeadReport(lead) {
  const prompt = `Eres el analista estratégico de CAST Consultorías. Analiza este lead y genera un reporte ejecutivo en español.

DATOS DEL LEAD:
- Nombre: ${lead.name}
- Empresa: ${lead.company || '—'}
- País: ${lead.country || '—'}
- Sector: ${lead.sector || '—'}
- Score IVC inicial: ${lead.score} (Nivel ${lead.level})
- Tipo de dolor: ${lead.painType || '—'}
- Etapa del proyecto: ${lead.projectStage || '—'}
- Fuente: ${lead.source || '—'}
- Notas adicionales: ${lead.notes || '—'}

Genera el reporte con EXACTAMENTE estas 6 secciones en formato Markdown. Sé preciso, estratégico y directo. Máximo 120 palabras por sección.

## 1. Perfil Ejecutivo
Quién es, qué hace, contexto general del lead y su empresa.

## 2. Dolor Real Identificado
El problema de fondo que tiene. No lo superficial — el dolor que realmente lo trae a CAST.

## 3. Viabilidad del Proyecto
¿Tiene el perfil para convertirse en cliente? ¿Su problema es solucionable con lo que hace CAST?

## 4. Contexto de Mercado
Situación del sector en el que opera. Oportunidades y presiones externas relevantes.

## 5. Alertas y Señales de Riesgo
Señales de alerta: objeciones probables, riesgos de cierre, factores que pueden complicar la venta.

## 6. Ruta Preliminar Sugerida
Recomendación concreta para la Blueprint Session: qué explorar, qué preguntar, qué proponer.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text;
}

// Fase 7 — Blueprints FDE+PMP: estructura una respuesta cruda (tecleada o dictada
// por voz) sin inventar información. "AI puede sugerir. El FDE confirma." (§10.1)
async function structureBlueprintAnswer(questionPrompt, rawText) {
  const prompt = `Eres el asistente de estructuración de Blueprints FDE+PMP de CAST Consultorías. Un Forward Deployed Engineer (FDE) escribió o dictó la respuesta de un cliente a esta pregunta durante una sesión de discovery operacional.

PREGUNTA: "${questionPrompt}"

RESPUESTA CRUDA DEL FDE (puede venir de dictado por voz, con errores de transcripción o redacción suelta):
"${rawText}"

Tu tarea: limpiar y estructurar esta respuesta en un texto claro y profesional en español, SIN inventar ni agregar información que no esté en el texto original. Corrige errores obvios de transcripción de voz y redacción, pero conserva TODOS los hechos, cifras y detalles tal como los dio el cliente.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni markdown, con este formato exacto:
{"structuredText": "...", "confidence": 0.0, "notes": "..."}

- structuredText: la respuesta limpia y estructurada.
- confidence: número entre 0.0 y 1.0 — qué tan seguro estás de que la estructuración preserva fielmente el significado original (1.0 = texto ya estaba claro, 0.5 = hay partes ambiguas, 0.0 = el texto no tiene sentido o está vacío).
- notes: máximo una frase, solo si detectas algo ambiguo que el FDE debería verificar con el cliente. Cadena vacía ("") si no hay nada que señalar.`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].text.trim();
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
    return {
      structuredText: parsed.structuredText || rawText,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      notes: parsed.notes || '',
    };
  } catch {
    return { structuredText: rawText, confidence: 0.5, notes: 'No se pudo estructurar automáticamente — se mantiene el texto original.' };
  }
}

// Fase 8 — CAST Scoring Engine: Claude ESTIMA las variables de entrada de los 5
// scores a partir del hallazgo + evidencia; el FDE siempre revisa/ajusta antes de
// calcular (mismo principio de Fase 7: "AI puede sugerir. El FDE confirma.").
const {
  COS_WEIGHTS, COS_VARIABLE_LABELS,
  AUTOMATION_POTENTIAL_VARIABLES, AUTOMATION_POTENTIAL_LABELS,
  AI_OPPORTUNITY_DIMENSIONS, AI_OPPORTUNITY_LABELS,
  CAST_VOICE_VARIABLES, CAST_VOICE_LABELS,
  PM_OPPORTUNITY_CRITERIA, PM_OPPORTUNITY_LABELS,
} = require('../config/blueprintScoring.config');

async function estimateBlueprintFindingScores(finding, evidenceText) {
  const cosVars = Object.keys(COS_WEIGHTS).map(k => `  - ${k}: ${COS_VARIABLE_LABELS[k]}`).join('\n');
  const apVars = AUTOMATION_POTENTIAL_VARIABLES.map(k => `  - ${k}: ${AUTOMATION_POTENTIAL_LABELS[k]}`).join('\n');
  const aiDims = AI_OPPORTUNITY_DIMENSIONS.map(k => `  - ${k}: ${AI_OPPORTUNITY_LABELS[k]}`).join('\n');
  const voiceVars = CAST_VOICE_VARIABLES.map(k => `  - ${k}: ${CAST_VOICE_LABELS[k]}`).join('\n');
  const pmCriteria = PM_OPPORTUNITY_CRITERIA.map(k => `  - ${k}: ${PM_OPPORTUNITY_LABELS[k]}`).join('\n');

  const prompt = `Eres el motor de scoring de CAST Consultorías para Blueprints FDE+PMP. Un Forward Deployed Engineer (FDE) identificó este hallazgo (oportunidad) durante una sesión de discovery operacional con un cliente:

CATEGORÍA: ${finding.category}
TÍTULO: ${finding.title}
DESCRIPCIÓN: ${finding.description || '(sin descripción adicional)'}
${evidenceText ? `\nEVIDENCIA (respuestas del cliente relacionadas):\n${evidenceText}` : ''}

Tu tarea: estimar, basándote SOLO en la información dada (sin inventar hechos que no estén presentes), las variables de entrada para 5 scores independientes. Cada variable de escala 0-5 se califica así: 0=nula/no aplica, 1=muy baja, 2=baja, 3=media, 4=alta, 5=muy alta/crítica. Si no hay evidencia suficiente para estimar una variable con confianza, usa tu mejor estimación conservadora (nunca dejes un campo vacío) y menciónalo en "notes".

Variables de COS (CAST Opportunity Score), escala 0-5 cada una:
${cosVars}

Variables de Automation Potential, escala 0-5 cada una:
${apVars}

Dimensiones de AI Opportunity — responde true/false si esa dimensión aplica a este hallazgo:
${aiDims}

Variables de CAST Voice Index, escala 0-5 cada una:
${voiceVars}

Criterios de PM Opportunity — responde true/false si ese criterio aplica a este hallazgo:
${pmCriteria}

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni markdown, con este formato exacto (usa los nombres de variable EXACTOS de arriba como llaves):
{"cos": {...8 llaves 0-5...}, "automationPotential": {...6 llaves 0-5...}, "aiOpportunity": {...7 llaves true/false...}, "castVoiceIndex": {...8 llaves 0-5...}, "pmOpportunity": {...9 llaves true/false...}, "notes": "..."}`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].text.trim();
  try {
    return JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
  } catch {
    const zeros = keys => Object.fromEntries(keys.map(k => [k, 0]));
    const falses = keys => Object.fromEntries(keys.map(k => [k, false]));
    return {
      cos: zeros(Object.keys(COS_WEIGHTS)),
      automationPotential: zeros(AUTOMATION_POTENTIAL_VARIABLES),
      aiOpportunity: falses(AI_OPPORTUNITY_DIMENSIONS),
      castVoiceIndex: zeros(CAST_VOICE_VARIABLES),
      pmOpportunity: falses(PM_OPPORTUNITY_CRITERIA),
      notes: 'No se pudo estimar automáticamente — revisa y califica manualmente.',
    };
  }
}

module.exports = { generateLeadReport, structureBlueprintAnswer, estimateBlueprintFindingScores };
