-- ════════════════════════════════════════════════════════════════════
-- CAST CRM — Supabase Schema v1.0
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ════════════════════════════════════════════════════════════════════

-- ─── USERS ────────────────────────────────────────────────────────
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  name          text not null,
  role          text not null default 'equipo',
  is_ceo        boolean not null default false,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  last_login    timestamptz,
  color         text,
  initials      text
);

-- ─── LEADS ────────────────────────────────────────────────────────
create table if not exists leads (
  id                    uuid primary key,
  name                  text not null,
  company               text,
  email                 text,
  phone                 text,
  country               text,
  sector                text,
  score                 integer not null default 0,
  level                 text,
  stage                 text not null default '01',
  value_usd             integer not null default 0,
  probability           integer not null default 0,
  pain_type             text,
  project_stage         text,
  source                text,
  assignee              text,
  flow_type             text,
  tier                  text,
  report_ia             boolean not null default false,
  blueprint_done        boolean not null default false,
  ivc_rs                numeric(10,4) not null default 0,
  ivc_pp                numeric(10,4) not null default 0,
  ivc_rt                numeric(10,4) not null default 0,
  ivc_es                numeric(10,4) not null default 0,
  ivc_score             numeric(10,4),
  sla_active            boolean not null default false,
  sla_start_time        timestamptz,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  entry_type            text not null default 'automatic',
  drive_folder_id       text,
  loom_url              text,
  deliverable_url       text,
  next_action           text,
  next_action_date      timestamptz,
  next_action_assignee  text,
  closed_lost_reason    text,
  closed_lost_category  text,
  recontact_date        date,
  report_content        text,
  lead_code             text unique
);

-- ─── ACTIVITY LOG ─────────────────────────────────────────────────
create table if not exists activity_log (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  timestamp   timestamptz not null default now(),
  user_id     text not null,
  user_name   text not null,
  user_role   text,
  action      text not null,
  detail      text,
  stage_at    text,
  ip_address  text
);

-- ─── BLUEPRINT SESSIONS ───────────────────────────────────────────
create table if not exists blueprint_sessions (
  id                      uuid primary key default gen_random_uuid(),
  lead_id                 uuid unique not null references leads(id) on delete cascade,
  conducted_by            text,
  session_date            date,

  -- Phase completion flags
  phase00_done            boolean not null default false,
  phase01_done            boolean not null default false,
  phase02_done            boolean not null default false,
  phase03_done            boolean not null default false,
  phase04_done            boolean not null default false,
  phase05_done            boolean not null default false,

  -- Phase checklists (claves únicas por ítem)
  chk00a                  boolean not null default false,
  chk00b                  boolean not null default false,
  chk00c                  boolean not null default false,
  chk00d                  boolean not null default false,
  chk01a                  boolean not null default false,
  chk01b                  boolean not null default false,
  chk01c                  boolean not null default false,
  chk02a                  boolean not null default false,

  -- Phase notes & narratives
  phase02_notes           text,
  phase04_heaven          text,
  phase04_hell            text,
  phase04_financial       text,
  phase05_mirror          text,
  phase05_insights        text,
  phase05_flow_confirmed  text,
  phase05_tier_confirmed  text,
  phase05_payment50       boolean not null default false,

  -- Bloque A — Contexto del proyecto
  q1                      text,
  q2                      text,
  q3                      text,
  q4_sector               text,
  q4_international        boolean not null default false,
  q5                      text,
  q5_amount               text,
  q6                      text,

  -- Bloque B — Velocidad / urgencia
  q7                      numeric(10,4) not null default 0,
  q8                      text,
  q8_time                 text,
  q9                      text,

  -- Bloque C — Recursos
  q10                     numeric(10,4) not null default 0,
  q10_calc                numeric(10,4) not null default 0,
  q11                     text,
  q11_time                text,

  -- Bloque D — Riesgo
  q12                     text,
  q12_rt                  numeric(10,4) not null default 0,
  q13                     text,

  -- Bloque E — Stakeholders
  q14                     text,
  q14_es                  numeric(10,4) not null default 0,
  q15                     text,
  q16                     text,

  -- Bloque F — Consultores externos
  q17                     text,
  q17_consultors          text,
  q18                     text,

  -- Bloque G — Capital
  q19_capital             text,
  q20_external            boolean not null default false,
  q20_detail              text,
  q21_range               text,
  q21_tier                text,

  -- Bloque H — Preguntas libres
  block_h                 text,

  -- IVC & Output
  ivc_calculated          numeric(10,4),
  output_generated        boolean not null default false,
  output_approved_by      text,
  output_approved_at      timestamptz,
  output_notes            text,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ─── ATTACHMENTS ──────────────────────────────────────────────────
create table if not exists attachments (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references leads(id) on delete cascade,
  name            text not null,
  type            text,
  url             text,
  drive_file_id   text,
  uploaded_by     text,
  uploaded_at     timestamptz not null default now(),
  stage_at        text,
  description     text,
  size            text
);

-- ─── CLOSED LOST ──────────────────────────────────────────────────
create table if not exists closed_lost (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid references leads(id) on delete set null,
  name          text,
  company       text,
  email         text,
  sector        text,
  country       text,
  session_date  text,
  ivc_score     numeric(10,4),
  reason        text,
  category      text,
  recontact     boolean not null default false,
  notes         text,
  closed_at     timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════════════
create index if not exists leads_stage_idx          on leads(stage);
create index if not exists leads_lead_code_idx       on leads(lead_code);
create index if not exists leads_email_idx           on leads(email);
create index if not exists leads_assignee_idx        on leads(assignee);
create index if not exists leads_created_at_idx      on leads(created_at desc);
create index if not exists activity_log_lead_id_idx  on activity_log(lead_id);
create index if not exists activity_log_ts_idx       on activity_log(timestamp desc);
create index if not exists attachments_lead_id_idx   on attachments(lead_id);
create index if not exists users_email_idx           on users(email);

-- ════════════════════════════════════════════════════════════════════
-- TRIGGER: auto-update updated_at
-- ════════════════════════════════════════════════════════════════════
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_set_updated_at
  before update on leads
  for each row execute procedure set_updated_at();

create trigger blueprint_sessions_set_updated_at
  before update on blueprint_sessions
  for each row execute procedure set_updated_at();

-- ════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- El backend usa la service_role key → bypassa RLS automáticamente.
-- Habilitamos RLS igualmente como capa de seguridad extra.
-- ════════════════════════════════════════════════════════════════════
alter table users              enable row level security;
alter table leads              enable row level security;
alter table activity_log       enable row level security;
alter table blueprint_sessions enable row level security;
alter table attachments        enable row level security;
alter table closed_lost        enable row level security;

-- Políticas permisivas (el backend controla la auth por JWT propio)
create policy "backend_full_access" on users
  for all using (true) with check (true);

create policy "backend_full_access" on leads
  for all using (true) with check (true);

create policy "backend_full_access" on activity_log
  for all using (true) with check (true);

create policy "backend_full_access" on blueprint_sessions
  for all using (true) with check (true);

create policy "backend_full_access" on attachments
  for all using (true) with check (true);

create policy "backend_full_access" on closed_lost
  for all using (true) with check (true);
