// CAST Scoring Engine — Blueprints FDE+PMP™ — Fase 8
// Fuente: "Investigación V2 CAST Blueprint Session™ v1.0 2026" §27-31 (Master Spec).
// §27: "No utilizar un único score empresarial. Utilizar múltiples índices" — los
// cinco scores son independientes entre sí, ninguno deriva de otro.
//
// Pesos/umbrales marcados "asunción propuesta" abajo: la fuente no los especifica
// exactamente (solo nombra las variables) — confirmado con el CEO (2026-09-01)
// para proceder con estos valores como configuración editable, no hardcodeada.
// Si se ajustan, es un cambio aquí, nunca en el motor de cálculo.

// ─── 1. COS — CAST Opportunity Score (§27) — única fórmula con pesos explícitos en la fuente ───
const COS_WEIGHTS = {
  impactoEconomico:      0.20,
  frecuencia:             0.10,
  tiempo:                 0.10,
  severidad:              0.15,
  potencialMejora:        0.15,
  viabilidad:             0.10,
  complejidad:            0.10,
  potencialTecnologico:   0.10,
};
const COS_VARIABLE_LABELS = {
  impactoEconomico:    'Impacto económico',
  frecuencia:          'Frecuencia',
  tiempo:              'Tiempo',
  severidad:           'Severidad',
  potencialMejora:     'Potencial de mejora',
  viabilidad:          'Viabilidad',
  complejidad:         'Complejidad',
  potencialTecnologico:'Potencial tecnológico',
};
const COS_LEVELS = [
  { max: 1.9, label: 'LOW',      es: 'Bajo' },
  { max: 2.9, label: 'MODERATE', es: 'Moderado' },
  { max: 3.9, label: 'HIGH',     es: 'Alto' },
  { max: 5,   label: 'CRITICAL', es: 'Crítico' },
];

// ─── 2. Automation Potential (§28) — ASUNCIÓN PROPUESTA: promedio simple 0-5 ───
const AUTOMATION_POTENTIAL_VARIABLES = ['repetitividad', 'volumen', 'estandarizacion', 'reglas', 'manualidad', 'integrabilidad'];
const AUTOMATION_POTENTIAL_LABELS = {
  repetitividad: 'Repetitividad', volumen: 'Volumen', estandarizacion: 'Estandarización',
  reglas: 'Reglas claras', manualidad: 'Manualidad', integrabilidad: 'Integrabilidad',
};
const AUTOMATION_POTENTIAL_LEVELS = [
  { max: 1.9, label: 'LOW',         es: 'Bajo' },
  { max: 2.9, label: 'EXPLORATORY', es: 'Exploratorio' },
  { max: 3.9, label: 'OPPORTUNITY', es: 'Oportunidad' },
  { max: 5,   label: 'HIGH',        es: 'Alto' },
];

// ─── 3. AI Opportunity (§29) — ASUNCIÓN PROPUESTA: conteo de dimensiones 0-7 ───
const AI_OPPORTUNITY_DIMENSIONS = ['documentos', 'lenguaje', 'clasificacion', 'interpretacion', 'prediccion', 'generacion', 'conocimiento'];
const AI_OPPORTUNITY_LABELS = {
  documentos: 'Documentos', lenguaje: 'Lenguaje natural', clasificacion: 'Clasificación',
  interpretacion: 'Interpretación', prediccion: 'Predicción', generacion: 'Generación', conocimiento: 'Conocimiento consultable',
};
const AI_OPPORTUNITY_LEVELS = [ // sobre conteo 0-7, no escala 0-5
  { max: 1, label: 'LOW',    es: 'Bajo' },
  { max: 4, label: 'MEDIUM', es: 'Medio' },
  { max: 7, label: 'HIGH',   es: 'Alto' },
];

// ─── 4. CAST Voice Index (§30) — ASUNCIÓN PROPUESTA: promedio simple 0-5 ───
const CAST_VOICE_VARIABLES = ['volumenConversacional', 'whatsapp', 'leads', 'atencion', 'preguntasRepetitivas', 'seguimiento', 'agendamiento', 'soporte'];
const CAST_VOICE_LABELS = {
  volumenConversacional: 'Volumen conversacional', whatsapp: 'WhatsApp', leads: 'Leads',
  atencion: 'Atención', preguntasRepetitivas: 'Preguntas repetitivas', seguimiento: 'Seguimiento',
  agendamiento: 'Agendamiento', soporte: 'Soporte',
};
const CAST_VOICE_LEVELS = [
  { max: 1.9, label: 'LOW',        es: 'Bajo' },
  { max: 2.9, label: 'POTENTIAL',  es: 'Potencial' },
  { max: 3.9, label: 'OPPORTUNITY',es: 'Oportunidad' },
  { max: 5,   label: 'HIGH',       es: 'Alto' },
];

// ─── 5. PM Opportunity (§31) — flag booleano, no score 0-5 ───
const PM_OPPORTUNITY_CRITERIA = ['multiplesStakeholders', 'multiplesAreas', 'dependencias', 'planificacion', 'transformacion', 'riesgo', 'gobernanza', 'implementacion', 'cambioOrganizacional'];
const PM_OPPORTUNITY_LABELS = {
  multiplesStakeholders: 'Múltiples stakeholders', multiplesAreas: 'Múltiples áreas', dependencias: 'Dependencias',
  planificacion: 'Planificación', transformacion: 'Transformación', riesgo: 'Riesgo',
  gobernanza: 'Gobernanza', implementacion: 'Implementación', cambioOrganizacional: 'Cambio organizacional',
};
// PM_COMPLEXITY (C1-C5) remite a la Complexity Matrix (§32) — no construida todavía.
// No se recalcula aparte aquí; queda NULL hasta que esa fase exista.

// ─── 6. Data Opportunity (Fase 9) — Bloque H. Sin fórmula en ninguna fuente —
// ASUNCIÓN PROPUESTA confirmada con el CEO 2026-09-01: promedio simple 0-5 de
// señales de dolor en el manejo de datos (mismo patrón que Automation Potential).
const DATA_OPPORTUNITY_VARIABLES = ['fragmentacion', 'desactualizacion', 'duplicidad', 'faltaTrazabilidad', 'decisionSinDatos', 'faltaVisibilidad'];
const DATA_OPPORTUNITY_LABELS = {
  fragmentacion: 'Datos no centralizados', desactualizacion: 'Datos desactualizados', duplicidad: 'Duplicados',
  faltaTrazabilidad: 'Sin consulta histórica', decisionSinDatos: 'Decide por experiencia, no por datos',
  faltaVisibilidad: 'Sin dashboards',
};
const DATA_OPPORTUNITY_LEVELS = [
  { max: 1.9, label: 'LOW',        es: 'Bajo' },
  { max: 2.9, label: 'EXPLORATORY', es: 'Exploratorio' },
  { max: 3.9, label: 'OPPORTUNITY', es: 'Oportunidad' },
  { max: 5,   label: 'HIGH',       es: 'Alto' },
];

// ─── 7. Technology Opportunity (Fase 9) — Bloque G. Sin fórmula en ninguna fuente —
// ASUNCIÓN PROPUESTA confirmada con el CEO 2026-09-01: promedio simple 0-5.
const TECHNOLOGY_OPPORTUNITY_VARIABLES = ['desconexionSistemas', 'transferenciaManual', 'dependenciaExcel', 'softwareObsoleto', 'brechaTecnologica'];
const TECHNOLOGY_OPPORTUNITY_LABELS = {
  desconexionSistemas: 'Sistemas no conectados', transferenciaManual: 'Transferencia manual entre sistemas',
  dependenciaExcel: 'Dependencia de Excel/Sheets', softwareObsoleto: 'Software obsoleto', brechaTecnologica: 'Tecnología que falta',
};
const TECHNOLOGY_OPPORTUNITY_LEVELS = [
  { max: 1.9, label: 'LOW',        es: 'Bajo' },
  { max: 2.9, label: 'EXPLORATORY', es: 'Exploratorio' },
  { max: 3.9, label: 'OPPORTUNITY', es: 'Oportunidad' },
  { max: 5,   label: 'HIGH',       es: 'Alto' },
];

// ─── 8. Priority del Opportunity Register (Fase 9) — sin fórmula en ninguna
// fuente. ASUNCIÓN PROPUESTA confirmada con el CEO 2026-09-01: deriva de COS +
// PM Opportunity (no crea un sexto score — solo prioriza lo ya calculado, §27).
function derivePriority(cosLevel, pmOpportunity) {
  if (cosLevel === 'CRITICAL') return 'P1';
  if (cosLevel === 'HIGH') return 'P2';
  if (pmOpportunity) return 'P2';
  return 'P3';
}

module.exports = {
  COS_WEIGHTS, COS_VARIABLE_LABELS, COS_LEVELS,
  AUTOMATION_POTENTIAL_VARIABLES, AUTOMATION_POTENTIAL_LABELS, AUTOMATION_POTENTIAL_LEVELS,
  AI_OPPORTUNITY_DIMENSIONS, AI_OPPORTUNITY_LABELS, AI_OPPORTUNITY_LEVELS,
  DATA_OPPORTUNITY_VARIABLES, DATA_OPPORTUNITY_LABELS, DATA_OPPORTUNITY_LEVELS,
  TECHNOLOGY_OPPORTUNITY_VARIABLES, TECHNOLOGY_OPPORTUNITY_LABELS, TECHNOLOGY_OPPORTUNITY_LEVELS,
  derivePriority,
  CAST_VOICE_VARIABLES, CAST_VOICE_LABELS, CAST_VOICE_LEVELS,
  PM_OPPORTUNITY_CRITERIA, PM_OPPORTUNITY_LABELS,
};
