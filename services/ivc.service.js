const { VELOCITY_MAP, INVOLVEMENT_MAP, INVESTMENT_TIER } = require('../config/constants');

function calculateIVC(rs, ppBase, q12Velocity, q14Involvement) {
  const pp = ppBase / 10;
  const rt = VELOCITY_MAP[q12Velocity] || 5;
  const es = INVOLVEMENT_MAP[q14Involvement] || 5;
  if (!rs || !rt || !es) return null;
  const ivc = (rs * pp) / (rt * es);
  return {
    ivcScore:      parseFloat(ivc.toFixed(2)),
    rs, pp, rt, es,
    level:         ivc >= 7 ? 'high' : ivc >= 3 ? 'medium' : 'risk',
    label:         ivc >= 7 ? 'ALTA CONVERSIÓN' : ivc >= 3 ? 'POTENCIAL MEDIO' : 'RIESGO ALTO',
    tierSuggested: ivc >= 7 ? 'Premium' : ivc >= 3 ? 'Pro' : 'Esencial',
  };
}

function getLevel(score) {
  if (score >= 88) return 'A';
  if (score >= 66) return 'B';
  if (score >= 44) return 'C';
  return 'D';
}

function generateOutputEvaluation(lead, blueprint) {
  const ivcResult = blueprint.ivcCalculated
    ? { ivcScore: blueprint.ivcCalculated, label: blueprint.ivcCalculated >= 7 ? 'ALTA CONVERSIÓN' : blueprint.ivcCalculated >= 3 ? 'POTENCIAL MEDIO' : 'RIESGO ALTO', tierSuggested: blueprint.ivcCalculated >= 7 ? 'Premium' : blueprint.ivcCalculated >= 3 ? 'Pro' : 'Esencial' }
    : null;

  return {
    leadName:       lead.name,
    company:        lead.company,
    sessionDate:    blueprint.sessionDate,
    conductedBy:    blueprint.conductedBy,
    ivcScore:       blueprint.ivcCalculated,
    ivcLevel:       ivcResult,
    tierSuggested:  blueprint.q21Tier || ivcResult?.tierSuggested,
    flowSuggested:  blueprint.phase05FlowConfirmed,
    painSummary:    [blueprint.q1, blueprint.q5, blueprint.q8].filter(Boolean).join(' / '),
    dreamResult:    `${blueprint.q5 || ''}${blueprint.q5Amount ? ` (Objetivo: ${blueprint.q5Amount})` : ''}`,
    personalImpact: blueprint.q6,
    alerts:         [blueprint.q16, blueprint.q17, blueprint.q18].filter(Boolean),
    financialContext: {
      capital:       blueprint.q19Capital,
      seekingExternal: blueprint.q20External,
      externalDetail:  blueprint.q20Detail,
      investmentRange: blueprint.q21Range,
    },
    fears:          blueprint.phase04Hell,
    aspirations:    blueprint.phase04Heaven,
    blockH:         blueprint.blockH,
    tier:           blueprint.q21Tier || blueprint.phase05TierConfirmed,
  };
}

module.exports = { calculateIVC, getLevel, generateOutputEvaluation };
