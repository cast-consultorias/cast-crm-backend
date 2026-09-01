-- CAST CRM — Blueprints FDE+PMP™ — Fase 9: ajuste de blueprint_opportunities
-- Ver docs/cast-strategy/CAST_OPPORTUNITY_SNAPSHOT_HANDOFF_SPEC.md (§33 de la fuente)
-- Ejecutar en Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fehnyryrwquxilhifdpm/sql/new
--
-- Mismo bug que blueprint_scores tenía antes de Fase 8: pm_opportunity es un FLAG
-- booleano en la especificación real (§31), no un score 0-5 — se modeló mal en
-- Fase 1 por falta del spec detallado. blueprint_opportunities sigue en 0 filas
-- reales (confirmado en la auditoría), así que este ALTER es seguro.
--
-- Faltaban además 10 de los 17 campos exactos del Opportunity Register: Problem,
-- Process, Impact, Root Cause, Risk, Evidence, Confidence, Potential Solution,
-- y las 2 nuevas dimensiones de scoring (Data Opportunity, Technology Opportunity)
-- que ni siquiera tenían fórmula en ningún documento — diseñadas ahora como
-- "asunción propuesta" (config editable), confirmado con el CEO 2026-09-01.

ALTER TABLE blueprint_opportunities
  ALTER COLUMN pm_opportunity DROP DEFAULT,
  ALTER COLUMN pm_opportunity TYPE BOOLEAN USING NULL;

ALTER TABLE blueprint_opportunities RENAME COLUMN priority_rank TO priority;
ALTER TABLE blueprint_opportunities
  ALTER COLUMN priority DROP DEFAULT,
  ALTER COLUMN priority TYPE TEXT USING NULL,
  ADD CONSTRAINT blueprint_opportunities_priority_check CHECK (priority IN ('P1','P2','P3'));

ALTER TABLE blueprint_opportunities
  ADD COLUMN IF NOT EXISTS problem              TEXT,   -- Bloque C
  ADD COLUMN IF NOT EXISTS process_ref           TEXT,   -- Bloque E
  ADD COLUMN IF NOT EXISTS impact                TEXT,   -- Bloque D
  ADD COLUMN IF NOT EXISTS root_cause            TEXT,
  ADD COLUMN IF NOT EXISTS risk                  TEXT,
  ADD COLUMN IF NOT EXISTS evidence              JSONB,  -- referencias a blueprint_findings.evidence_answer_ids
  ADD COLUMN IF NOT EXISTS confidence            NUMERIC,
  ADD COLUMN IF NOT EXISTS potential_solution    TEXT,   -- NULL a propósito — CAST Solution Mapping pendiente de catálogo real (el CEO lo entrega después)
  ADD COLUMN IF NOT EXISTS data_opportunity      NUMERIC,
  ADD COLUMN IF NOT EXISTS technology_opportunity NUMERIC;

-- category (blueprint_opportunities Y blueprint_findings) solo permitía 4 valores;
-- el Opportunity Register real tiene 6 tipos de oportunidad (agrega DATA, TECHNOLOGY).
ALTER TABLE blueprint_opportunities DROP CONSTRAINT blueprint_opportunities_category_check;
ALTER TABLE blueprint_opportunities ADD CONSTRAINT blueprint_opportunities_category_check
  CHECK (category IN ('PM','AUTOMATION','AI','CAST_VOICE','DATA','TECHNOLOGY'));

ALTER TABLE blueprint_findings DROP CONSTRAINT blueprint_findings_category_check;
ALTER TABLE blueprint_findings ADD CONSTRAINT blueprint_findings_category_check
  CHECK (category IN ('PM','AUTOMATION','AI','CAST_VOICE','DATA','TECHNOLOGY'));
