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

module.exports = { generateLeadReport };
