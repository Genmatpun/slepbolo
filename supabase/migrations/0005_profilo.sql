-- ============================================================
-- SLEPBOLO — Campo "zona preferita" sul profilo studente
-- ============================================================
alter table profiles
  add column if not exists zona_preferita text;
