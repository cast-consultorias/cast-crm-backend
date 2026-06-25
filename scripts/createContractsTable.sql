-- CAST CRM — Tabla de Contratos y Pagos
-- Ejecutar en Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fehnyryrwquxilhifdpm/sql/new
CREATE TABLE IF NOT EXISTS contracts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID        NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  contract_number   TEXT        DEFAULT '',
  total_value_cop   BIGINT      DEFAULT 0,
  concept           TEXT        DEFAULT '',
  payments          JSONB       NOT NULL DEFAULT '[
    {"label":"Primer Pago",    "amount":0,"date":null,"paid":false},
    {"label":"Segundo Pago",   "amount":0,"date":null,"paid":false},
    {"label":"Tercer Pago",    "amount":0,"date":null,"paid":false},
    {"label":"Cuarto Pago",    "amount":0,"date":null,"paid":false},
    {"label":"Saldo Pendiente","amount":0,"date":null,"paid":false}
  ]'::jsonb,
  notes             TEXT        DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
