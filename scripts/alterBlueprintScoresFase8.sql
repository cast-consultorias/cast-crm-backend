-- CAST CRM — Blueprints FDE+PMP™ — Fase 8: ajuste de blueprint_scores
-- Ver docs/cast-strategy — "Investigación V2 CAST Blueprint Session™ v1.0 2026" §27-31
-- Ejecutar en Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fehnyryrwquxilhifdpm/sql/new
--
-- pm_opportunity es un FLAG booleano en la especificación real (§31), no un score
-- 0-5 como los otros cuatro — la tabla original (Fase 1) lo modeló mal por falta
-- del Master Spec en ese momento. blueprint_scores sigue en 0 filas (confirmado),
-- así que este ALTER es seguro. pm_complexity queda nullable — remite a la
-- Complexity Matrix (Fase futura, aún no construida), nunca se recalcula aparte.

ALTER TABLE blueprint_scores
  ALTER COLUMN pm_opportunity DROP DEFAULT,
  ALTER COLUMN pm_opportunity TYPE BOOLEAN USING NULL,
  ADD COLUMN IF NOT EXISTS pm_opportunity_criteria JSONB,  -- qué criterios de §31 se cumplieron
  ADD COLUMN IF NOT EXISTS pm_complexity TEXT;              -- C1-C5, referencia a blueprint_complexity — NULL hasta que exista esa fase

-- Un hallazgo tiene un único registro de scores vigente (recalcular reemplaza el anterior).
ALTER TABLE blueprint_scores ADD CONSTRAINT blueprint_scores_finding_id_key UNIQUE (finding_id);

-- La Fase 1 no incluyó 'scoring' como suggestion_type válido — falta para la estimación de IA del §27-31.
ALTER TABLE blueprint_ai_suggestions DROP CONSTRAINT blueprint_ai_suggestions_suggestion_type_check;
ALTER TABLE blueprint_ai_suggestions ADD CONSTRAINT blueprint_ai_suggestions_suggestion_type_check
  CHECK (suggestion_type IN ('next_question','structuring','opportunity','inconsistency','summary','scoring'));
