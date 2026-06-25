-- ════════════════════════════════════════════════════════════════════
-- CAST CRM — Seed de usuarios iniciales
-- Ejecutar DESPUÉS de schema.sql
-- ════════════════════════════════════════════════════════════════════

-- Contraseña de ambos usuarios: cast2026
-- Hash generado con bcryptjs rounds=10

insert into users (id, email, password_hash, name, role, is_ceo, active, color, initials)
values
  (
    gen_random_uuid(),
    'carlos@castconsultorias.com',
    '$2a$10$YKGqoSNWzZO/mLstfiM3z.EiA4hU6xOdkeQbCsbGn6pdt0sqr9CDK',
    'Carlos Suárez Tous',
    'CEO',
    true,
    true,
    '#C9A84C',
    'CS'
  ),
  (
    gen_random_uuid(),
    'equipo@castconsultorias.com',
    '$2a$10$YKGqoSNWzZO/mLstfiM3z.EiA4hU6xOdkeQbCsbGn6pdt0sqr9CDK',
    'Equipo CAST',
    'equipo',
    false,
    true,
    '#007AFF',
    'EC'
  )
on conflict (email) do nothing;
