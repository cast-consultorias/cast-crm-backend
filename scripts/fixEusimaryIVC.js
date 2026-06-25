/**
 * Corrige los valores IVC de Eusimary Contreras (CAST-2026-011)
 * después del fix a la fórmula PP: (10 - q10) / 10
 *
 * q10 = 3 → PP_viejo = 0.3 → PP_nuevo = (10-3)/10 = 0.7
 * IVC_nuevo = (RS=10 × PP=0.7) / (RT=2 × ES=4) = 0.875
 *
 * Ejecutar: node scripts/fixEusimaryIVC.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const NOTE = `Decisión ejecutiva Carlos Suárez Tous: IVC corregido post-fix de fórmula. ` +
  `Eusimary confirmó capital propio disponible ($500 para iniciar), urgencia real de generación ` +
  `de ingresos adicionales, y compromiso verbal con el proceso. ` +
  `Avanza al siguiente paso por decisión del CEO. ` +
  `PP ajustado de 0.3 a 0.7 (fórmula corregida: no confiar en resolverlo sola = alta probabilidad de conversión con CAST).`;

async function main() {
  // 1. Encontrar lead por código
  const { data: leads, error: lErr } = await supabase
    .from('leads')
    .select('id, name, ivc_rs, ivc_pp, ivc_rt, ivc_es, ivc_score')
    .eq('lead_code', 'CAST-2026-011');

  if (lErr) throw new Error(`Error buscando lead: ${lErr.message}`);
  if (!leads?.length) throw new Error('Lead CAST-2026-011 no encontrado');

  const lead = leads[0];
  console.log(`Lead encontrado: ${lead.name} (${lead.id})`);
  console.log(`  IVC actual: RS=${lead.ivc_rs} PP=${lead.ivc_pp} RT=${lead.ivc_rt} ES=${lead.ivc_es} Score=${lead.ivc_score}`);

  const newPP    = (10 - 3) / 10;           // q10 = 3 → PP = 0.7
  const newScore = parseFloat(((lead.ivc_rs * newPP) / (lead.ivc_rt * lead.ivc_es)).toFixed(2));
  console.log(`  IVC nuevo:  RS=${lead.ivc_rs} PP=${newPP} RT=${lead.ivc_rt} ES=${lead.ivc_es} Score=${newScore}`);

  // 2. Actualizar leads
  const { error: luErr } = await supabase
    .from('leads')
    .update({ ivc_pp: newPP, ivc_score: newScore })
    .eq('id', lead.id);

  if (luErr) throw new Error(`Error actualizando lead: ${luErr.message}`);
  console.log(`✅ leads.ivc_pp y ivc_score actualizados`);

  // 3. Actualizar blueprint_session
  const { data: sessions, error: sErr } = await supabase
    .from('blueprint_sessions')
    .select('id, ivc_calculated, output_notes')
    .eq('lead_id', lead.id);

  if (sErr) throw new Error(`Error buscando blueprint session: ${sErr.message}`);

  if (!sessions?.length) {
    console.log('⚠️  No hay blueprint session — solo se actualizó el lead.');
    return;
  }

  const session = sessions[0];
  const { error: suErr } = await supabase
    .from('blueprint_sessions')
    .update({
      ivc_calculated: newScore,
      output_notes:   NOTE,
    })
    .eq('id', session.id);

  if (suErr) throw new Error(`Error actualizando blueprint session: ${suErr.message}`);
  console.log(`✅ blueprint_sessions.ivc_calculated y output_notes actualizados`);
  console.log(`\n🎉 Listo — IVC de Eusimary: 0.38 → ${newScore} (POTENCIAL MEDIO)`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
