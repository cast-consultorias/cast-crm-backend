-- CAST CRM — Blueprints FDE+PMP™ — Fase 1: Data Model
-- Ver docs/cast-strategy/CAST_BLUEPRINTS_FDE_PMP_v1.0_ANTIGRAVITY_IMPLEMENTATION.md § 04
-- Ejecutar en Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fehnyryrwquxilhifdpm/sql/new
--
-- Regla de no duplicación (§00): estas tablas son ADICIONALES a `blueprint_sessions`,
-- que pertenece a la CAST Blueprint Session™ (IVC) y NO se toca ni se referencia con
-- FK obligatoria aquí — son dos dominios distintos (ver Addendum del documento).
-- No incluye seed data del banco de preguntas (eso es Fase 4 — Question Engine).

-- ─── 1. Sesión FDE+PMP (distinta de blueprint_sessions/IVC) ──────────────────
CREATE TABLE IF NOT EXISTS blueprint_sessions_fde (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status                TEXT        NOT NULL DEFAULT 'DRAFT'
                                     CHECK (status IN ('DRAFT','READY','IN_PROGRESS','PAUSED',
                                       'PENDING_REVIEW','COMPLETED','ANALYSIS','BLUEPRINT_READY',
                                       'HANDED_OFF','ARCHIVED')),
  mode                  TEXT        NOT NULL DEFAULT 'A' CHECK (mode IN ('A','B','C')), -- A=presencial · B=remoto · C=CAST_AI_AGENT (deshabilitado v1.0)
  question_set_version  INT         NOT NULL DEFAULT 1,
  conducted_by          UUID        REFERENCES users(id),
  fde_supervisor_id     UUID        REFERENCES users(id),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  handed_off_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bpfde_sessions_lead ON blueprint_sessions_fde(lead_id);
CREATE INDEX IF NOT EXISTS idx_bpfde_sessions_status ON blueprint_sessions_fde(status);

-- ─── 2. Banco de preguntas versionado (§06, §07) ─────────────────────────────
CREATE TABLE IF NOT EXISTS blueprint_questions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT        NOT NULL, -- 'A01', 'G04.1', etc.
  block                 TEXT        NOT NULL, -- 'A'..'K'
  block_name            TEXT        NOT NULL,
  prompt                TEXT        NOT NULL,
  question_type         TEXT        NOT NULL DEFAULT 'text'
                                     CHECK (question_type IN ('text','select','boolean','number','subquestion')),
  parent_code           TEXT,       -- para subpreguntas condicionales (G04.1 → parent 'G04')
  order_index           INT         NOT NULL DEFAULT 0,
  allow_unknown         BOOLEAN     NOT NULL DEFAULT false, -- Bloque D siempre acepta UNKNOWN (§10.5)
  question_set_version  INT         NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (code, question_set_version)
);
CREATE INDEX IF NOT EXISTS idx_bpq_version ON blueprint_questions(question_set_version);

-- ─── 3. Reglas condicionales (§07 — G04, I01, J01) ───────────────────────────
CREATE TABLE IF NOT EXISTS blueprint_question_rules (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_question_code   TEXT        NOT NULL,
  trigger_value           TEXT        NOT NULL,
  activates_question_code TEXT        NOT NULL,
  question_set_version    INT         NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bpqr_trigger ON blueprint_question_rules(trigger_question_code, question_set_version);

-- ─── 4. Respuestas (estados de confianza — §04, §13) ─────────────────────────
CREATE TABLE IF NOT EXISTS blueprint_answers (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL REFERENCES blueprint_sessions_fde(id) ON DELETE CASCADE,
  question_code         TEXT        NOT NULL,
  question_set_version  INT         NOT NULL,
  answer_text           TEXT,
  answer_value          JSONB,
  confidence            NUMERIC,
  status                TEXT        NOT NULL DEFAULT 'AI_CAPTURED'
                                     CHECK (status IN ('AI_CAPTURED','AI_STRUCTURED','PENDING_REVIEW','PM_EDITED','PM_CONFIRMED')),
  captured_via          TEXT        CHECK (captured_via IN ('voice','text','selection')),
  confirmed_by          UUID        REFERENCES users(id),
  confirmed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_id, question_code)
);
CREATE INDEX IF NOT EXISTS idx_bpa_session ON blueprint_answers(session_id);

-- ─── 5. Evidencia de respuesta (§15 AC14) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS blueprint_answer_evidence (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id             UUID        NOT NULL REFERENCES blueprint_answers(id) ON DELETE CASCADE,
  evidence_type         TEXT        NOT NULL CHECK (evidence_type IN ('note','document','photo','audio')),
  url                   TEXT,
  notes                 TEXT,
  created_by            UUID        REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bpae_answer ON blueprint_answer_evidence(answer_id);

-- ─── 6. Transcripciones de voz (§09) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blueprint_transcripts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL REFERENCES blueprint_sessions_fde(id) ON DELETE CASCADE,
  speaker               TEXT        CHECK (speaker IN ('PM','CLIENT','UNKNOWN')),
  text_content           TEXT,
  audio_url             TEXT,
  segment_start_ms      INT,
  segment_end_ms        INT,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bpt_session ON blueprint_transcripts(session_id);

-- ─── 7. Sugerencias de IA (§08 — siguiente pregunta, estructuración, etc.) ───
CREATE TABLE IF NOT EXISTS blueprint_ai_suggestions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL REFERENCES blueprint_sessions_fde(id) ON DELETE CASCADE,
  suggestion_type       TEXT        NOT NULL CHECK (suggestion_type IN
                                     ('next_question','structuring','opportunity','inconsistency','summary')),
  payload               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status                TEXT        NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','REJECTED')),
  reviewed_by           UUID        REFERENCES users(id),
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bpais_session ON blueprint_ai_suggestions(session_id);

-- ─── 8. Hallazgos (unidad base que alimenta scores y Opportunity Register) ───
CREATE TABLE IF NOT EXISTS blueprint_findings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL REFERENCES blueprint_sessions_fde(id) ON DELETE CASCADE,
  process_ref           TEXT,
  category              TEXT        NOT NULL CHECK (category IN ('PM','AUTOMATION','AI','CAST_VOICE')),
  title                 TEXT        NOT NULL,
  description           TEXT,
  evidence_answer_ids   UUID[]      DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bpf_session ON blueprint_findings(session_id);

-- ─── 9. Scores por hallazgo (§08, §14 — COS, Automation Potential, AI Opportunity, CAST Voice Index, PM Opportunity) ───
CREATE TABLE IF NOT EXISTS blueprint_scores (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL REFERENCES blueprint_sessions_fde(id) ON DELETE CASCADE,
  finding_id            UUID        REFERENCES blueprint_findings(id) ON DELETE CASCADE,
  cos                   NUMERIC,
  automation_potential  NUMERIC,
  ai_opportunity        NUMERIC,
  cast_voice_index      NUMERIC,
  pm_opportunity        NUMERIC,
  variables             JSONB       DEFAULT '{}'::jsonb, -- las 8 variables ponderadas (§6 de la Reconciliación)
  calculated_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bps_session ON blueprint_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_bps_finding ON blueprint_scores(finding_id);

-- ─── 10. Complexity Matrix (§15 AC17) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blueprint_complexity (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL REFERENCES blueprint_sessions_fde(id) ON DELETE CASCADE,
  finding_id            UUID        REFERENCES blueprint_findings(id) ON DELETE CASCADE,
  complexity_score      NUMERIC,
  dimensions            JSONB       DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bpc_session ON blueprint_complexity(session_id);

-- ─── 11. Opportunity Register (§15 AC16 — el entregable central) ─────────────
CREATE TABLE IF NOT EXISTS blueprint_opportunities (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL REFERENCES blueprint_sessions_fde(id) ON DELETE CASCADE,
  finding_id            UUID        NOT NULL REFERENCES blueprint_findings(id) ON DELETE CASCADE,
  category              TEXT        NOT NULL CHECK (category IN ('PM','AUTOMATION','AI','CAST_VOICE')),
  title                 TEXT        NOT NULL,
  description           TEXT,
  priority_rank         INT,
  cos                   NUMERIC,
  automation_potential  NUMERIC,
  ai_opportunity        NUMERIC,
  cast_voice_index      NUMERIC,
  pm_opportunity        NUMERIC,
  complexity_score      NUMERIC,
  status                TEXT        NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_REVIEW','PROMOTED','DISCARDED')),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bpo_session ON blueprint_opportunities(session_id);
CREATE INDEX IF NOT EXISTS idx_bpo_status ON blueprint_opportunities(status);

-- ─── 12. Recomendaciones ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blueprint_recommendations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL REFERENCES blueprint_sessions_fde(id) ON DELETE CASCADE,
  opportunity_id        UUID        REFERENCES blueprint_opportunities(id) ON DELETE SET NULL,
  recommendation_text   TEXT        NOT NULL,
  rationale             TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bpr_session ON blueprint_recommendations(session_id);

-- ─── 13. Blueprint Snapshot (§15 AC18 — generado al completar sesión) ────────
CREATE TABLE IF NOT EXISTS blueprint_snapshots (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL UNIQUE REFERENCES blueprint_sessions_fde(id) ON DELETE CASCADE,
  snapshot              JSONB       NOT NULL,
  version               INT         NOT NULL DEFAULT 1,
  generated_at          TIMESTAMPTZ DEFAULT now()
);

-- ─── 14. Audit log (§10.8 — ningún cambio crítico sin quedar registrado) ─────
CREATE TABLE IF NOT EXISTS blueprint_audit_log (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL REFERENCES blueprint_sessions_fde(id) ON DELETE CASCADE,
  actor_id              UUID        REFERENCES users(id),
  actor_role            TEXT,
  action                TEXT        NOT NULL,
  before                JSONB,
  after                 JSONB,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bpal_session ON blueprint_audit_log(session_id);

-- ─── 15. Consentimiento de voz (§09 — obligatorio antes de grabar) ───────────
CREATE TABLE IF NOT EXISTS blueprint_voice_consents (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL REFERENCES blueprint_sessions_fde(id) ON DELETE CASCADE,
  authorized            BOOLEAN     NOT NULL,
  captured_by           UUID        REFERENCES users(id),
  captured_at           TIMESTAMPTZ DEFAULT now(),
  notes                 TEXT
);
CREATE INDEX IF NOT EXISTS idx_bpvc_session ON blueprint_voice_consents(session_id);
