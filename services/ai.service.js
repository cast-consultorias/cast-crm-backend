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

module.exports = { generateLeadReport, structureBlueprintAnswer };
