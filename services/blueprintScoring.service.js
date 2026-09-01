// CAST Scoring Engine — Blueprints FDE+PMP™ — Fase 8. Cálculo puro, sin efectos
// secundarios — services/supabase.service.js persiste, este archivo solo calcula.
const cfg = require('../config/blueprintScoring.config');

const clamp05 = n => Math.max(0, Math.min(5, Number(n) || 0));

function levelFor(value, levels) {
  for (const l of levels) if (value <= l.max) return l.label;
  return levels[levels.length - 1].label;
}

// §27 — COS = suma ponderada de 8 variables 0-5, pesos exactos de la fuente
function calcCOS(vars = {}) {
  let score = 0;
  for (const [key, weight] of Object.entries(cfg.COS_WEIGHTS)) {
    score += clamp05(vars[key]) * weight;
  }
  score = parseFloat(score.toFixed(2));
  return { score, level: levelFor(score, cfg.COS_LEVELS) };
}

// §28 — Automation Potential = promedio simple de 6 variables 0-5 (asunción propuesta)
function calcAutomationPotential(vars = {}) {
  const values = cfg.AUTOMATION_POTENTIAL_VARIABLES.map(k => clamp05(vars[k]));
  const score = parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
  return { score, level: levelFor(score, cfg.AUTOMATION_POTENTIAL_LEVELS) };
}

// §29 — AI Opportunity = conteo de dimensiones presentes, 0-7 (asunción propuesta)
function calcAiOpportunity(dimensions = {}) {
  const present = cfg.AI_OPPORTUNITY_DIMENSIONS.filter(d => !!dimensions[d]);
  const score = present.length;
  return { score, level: levelFor(score, cfg.AI_OPPORTUNITY_LEVELS), dimensions: present };
}

// §30 — CAST Voice Index = promedio simple de 8 variables 0-5 (asunción propuesta)
function calcCastVoiceIndex(vars = {}) {
  const values = cfg.CAST_VOICE_VARIABLES.map(k => clamp05(vars[k]));
  const score = parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
  return { score, level: levelFor(score, cfg.CAST_VOICE_LEVELS) };
}

// §31 — PM Opportunity = flag booleano si aplica alguno de 9 criterios
function calcPmOpportunity(criteria = {}) {
  const matched = cfg.PM_OPPORTUNITY_CRITERIA.filter(c => !!criteria[c]);
  return { opportunity: matched.length > 0, matchedCriteria: matched };
}

// Corre los 5 scores independientes de una sola vez (§27: independientes entre sí,
// ninguno deriva de otro — por eso se calculan por separado, no en cascada)
function calcAllScores({ cos = {}, automationPotential = {}, aiOpportunity = {}, castVoiceIndex = {}, pmOpportunity = {} }) {
  return {
    cos: calcCOS(cos),
    automationPotential: calcAutomationPotential(automationPotential),
    aiOpportunity: calcAiOpportunity(aiOpportunity),
    castVoiceIndex: calcCastVoiceIndex(castVoiceIndex),
    pmOpportunity: calcPmOpportunity(pmOpportunity),
  };
}

module.exports = { calcCOS, calcAutomationPotential, calcAiOpportunity, calcCastVoiceIndex, calcPmOpportunity, calcAllScores, levelFor };
