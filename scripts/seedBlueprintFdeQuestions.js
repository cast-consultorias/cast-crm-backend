// CAST CRM — Blueprints FDE+PMP™ — Fase 4: seed del banco de preguntas (§07)
// Texto e IDs exactos del documento de implementación. version 1.
// Ejecutar una sola vez: node scripts/seedBlueprintFdeQuestions.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const VERSION = 1;

const BLOCKS = {
  A: { name: 'Contexto', questions: [
    'Nombre de empresa.', 'Nombre del participante.', 'Cargo.', 'Actividad principal.', 'Sector.',
    'Número aproximado de personas.', 'Tiempo operando.', 'Ubicación / mercado.', 'Canales de operación.',
    'Principal reto actual.',
  ]},
  B: { name: 'Modelo de Negocio', questions: [
    '¿Qué productos o servicios generan la mayor parte de los ingresos?', '¿Quién es el cliente principal?',
    '¿Cómo llega normalmente un cliente?', '¿Qué ocurre desde que aparece un cliente potencial hasta que se convierte en cliente?',
    '¿Cómo se realiza actualmente la venta?', '¿Cómo se entrega el producto o servicio?', '¿Cómo se factura y cobra?',
    '¿Cuáles son los procesos críticos?', '¿Qué parte del negocio depende directamente de usted o de una persona específica?',
    'Si esa persona no estuviera disponible durante 30 días, ¿qué procesos se afectarían?',
  ]},
  C: { name: 'Problema', questions: [
    '¿Qué situación hizo que quisiera realizar esta sesión?', '¿Cuál es el principal problema que quisiera resolver?',
    '¿Desde cuándo existe?', '¿Con qué frecuencia ocurre?', '¿En qué proceso ocurre?', '¿Quiénes se ven afectados?',
    '¿Qué han intentado hacer?', '¿Qué ocurrió con esos intentos?', 'Si mañana desapareciera este problema, ¿qué cambiaría concretamente?',
  ]},
  D: { name: 'Impacto', allowUnknown: true, questions: [
    '¿Cuánto tiempo dedica el equipo actualmente?', '¿Cuántas personas participan?', '¿Cuántas veces se ejecuta?',
    '¿Cuánto tarda?', '¿Cuántos errores/reprocesos genera?', '¿Ha generado pérdida de clientes?',
    '¿Ha generado pérdida de ingresos?', '¿Ha generado costos adicionales?', '¿Ha generado riesgos?',
    '¿Cuál sería aproximadamente el impacto económico de resolverlo?',
  ]},
  E: { name: 'Procesos', questions: [
    'Seleccionar proceso problemático.', '¿Qué inicia el proceso?', '¿Qué información necesita?',
    '¿Qué actividades se realizan?', '¿Quién realiza cada actividad?', '¿Qué herramientas utiliza?',
    '¿Dónde se registra la información?', '¿Qué decisiones deben tomarse?', '¿Dónde se producen esperas?',
    '¿Dónde se producen errores?', '¿Dónde se repite trabajo?', '¿Cuál es la actividad más lenta?',
    '¿Qué actividad considera innecesaria?', '¿Qué ocurre cuando el proceso falla?',
  ]},
  F: { name: 'Personas', questions: [
    '¿Cuántas personas participan?', '¿Qué roles intervienen?', '¿Existe una persona cuya ausencia detenga el proceso?',
    '¿Qué actividades son manuales?', '¿Qué actividades requieren copiar información?',
    '¿Qué actividades requieren revisión repetitiva?', '¿Qué tareas consumen tiempo de personal especializado?',
    '¿Dónde existe mayor sobrecarga?', '¿Qué tareas aportan poco valor?',
  ]},
  G: { name: 'Tecnología', questions: [
    'Herramientas actuales.', 'Sistemas críticos.', '¿Los sistemas están conectados?',
    { text: '¿Se copia información entre sistemas?', type: 'boolean', conditional: true },
    '¿Existen procesos dependientes de Excel/Sheets?', '¿Existe software obsoleto?', '¿Qué tecnología siente que falta?',
    'Restricciones tecnológicas/presupuestales.',
  ]},
  H: { name: 'Datos', questions: [
    '¿Dónde se almacena la información?', '¿Está centralizada?', '¿Quién accede?', '¿Está actualizada?',
    '¿Existen duplicados?', '¿Existen datos incompletos?', '¿Puede consultar información histórica?',
    '¿Utiliza dashboards?', '¿Decide con datos o principalmente con experiencia?', '¿Qué información quisiera conocer automáticamente?',
  ]},
  I: { name: 'Automatización', questions: [
    { text: '¿Existen tareas repetitivas?', type: 'boolean', conditional: true },
    '¿Existen tareas que siguen siempre los mismos pasos?', '¿Existen tareas de copiar/pegar/revisar/clasificar?',
    '¿Existen eventos que inician procesos?', '¿Existen reglas claras?', '¿Existen notificaciones manuales?',
    '¿Existen reportes manuales?', '¿Qué tarea automatizaría inmediatamente?',
  ]},
  J: { name: 'Inteligencia Artificial', questions: [
    { text: '¿Existen documentos que deban analizarse?', type: 'boolean', conditional: true },
    '¿Existen mensajes que deban clasificarse?', '¿Existen preguntas repetitivas?',
    '¿Existen decisiones que requieren analizar mucha información?', '¿Existen documentos que deban resumirse/compararse?',
    '¿Existen actividades de interpretación humana?', '¿Serían útiles predicciones?',
    '¿Existe conocimiento interno que debería poder consultarse mediante lenguaje natural?',
    '¿Existen comunicaciones que podrían ser asistidas por IA?', '¿Qué actividad intelectual repetitiva quisiera reducir?',
  ]},
  K: { name: 'Futuro Deseado', questions: [
    '¿Cómo quisiera que funcionara el proceso idealmente?', '¿Qué debería dejar de hacer manualmente el equipo?',
    '¿Qué debería ocurrir automáticamente?', '¿Qué información debería tener en tiempo real?',
    '¿Qué decisiones quisiera acelerar?', '¿Qué experiencia quisiera mejorar?', '¿Qué resultado consideraría exitoso?',
    '¿En cuánto tiempo quisiera ver resultados?', 'Restricciones.',
  ]},
};

// Subpreguntas condicionales (§07) — activadas por blueprint_question_rules, no por defecto
const SUBQUESTIONS = {
  G04: ['¿Entre qué sistemas?', '¿Con qué frecuencia?', '¿Quién realiza la transferencia?', '¿Cuánto tiempo consume?'],
  I01: ['¿Qué tarea?', '¿Cuántas veces?', '¿Cuántas personas?', '¿Cuánto tiempo?'],
  J01: ['¿Qué documentos?', '¿Cuántos?', '¿Quién los analiza?', '¿Qué decisión depende del análisis?'],
};

function buildQuestions() {
  const rows = [];
  for (const [blockId, block] of Object.entries(BLOCKS)) {
    block.questions.forEach((q, i) => {
      const n = String(i + 1).padStart(2, '0');
      const code = `${blockId}${n}`;
      const isObj = typeof q === 'object';
      rows.push({
        code, block: blockId, block_name: block.name,
        prompt: isObj ? q.text : q,
        question_type: isObj ? q.type : 'text',
        parent_code: null,
        order_index: (i + 1) * 10,
        allow_unknown: !!block.allowUnknown,
        question_set_version: VERSION,
      });
      if (isObj && q.conditional && SUBQUESTIONS[code]) {
        SUBQUESTIONS[code].forEach((subText, j) => {
          rows.push({
            code: `${code}.${j + 1}`, block: blockId, block_name: block.name,
            prompt: subText, question_type: 'subquestion', parent_code: code,
            order_index: (i + 1) * 10 + j + 1, allow_unknown: !!block.allowUnknown,
            question_set_version: VERSION,
          });
        });
      }
    });
  }
  return rows;
}

const RULES = [
  ...['G04.1', 'G04.2', 'G04.3', 'G04.4'].map(c => ({ trigger_question_code: 'G04', trigger_value: 'SI', activates_question_code: c, question_set_version: VERSION })),
  ...['I01.1', 'I01.2', 'I01.3', 'I01.4'].map(c => ({ trigger_question_code: 'I01', trigger_value: 'SI', activates_question_code: c, question_set_version: VERSION })),
  ...['J01.1', 'J01.2', 'J01.3', 'J01.4'].map(c => ({ trigger_question_code: 'J01', trigger_value: 'SI', activates_question_code: c, question_set_version: VERSION })),
];

(async () => {
  const questions = buildQuestions();

  const { data: existing } = await supabase.from('blueprint_questions').select('id').eq('question_set_version', VERSION).limit(1);
  if (existing && existing.length > 0) {
    console.log(`⚠️  Ya existen preguntas para question_set_version=${VERSION}. Nada que hacer (idempotente).`);
    return;
  }

  const { error: qErr } = await supabase.from('blueprint_questions').insert(questions);
  if (qErr) throw qErr;
  console.log(`✅ ${questions.length} preguntas insertadas (Bloques A–K, version ${VERSION})`);

  const { error: rErr } = await supabase.from('blueprint_question_rules').insert(RULES);
  if (rErr) throw rErr;
  console.log(`✅ ${RULES.length} reglas condicionales insertadas`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
