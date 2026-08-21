-- ============================================================
-- SLEPBOLO — Campi contatto sull'annuncio
-- L'host mette i suoi recapiti; chi cerca lo contatta direttamente.
-- La piattaforma non fa da intermediario.
-- ============================================================

alter table apartments
  add column if not exists contatto_nome     text,
  add column if not exists contatto_telefono text,
  add column if not exists contatto_whatsapp text,
  add column if not exists contatto_email    text,
  add column if not exists contatto_note      text,
  add column if not exists foto_urls          text[] not null default '{}';

-- Recapiti di esempio sugli annunci demo (host fittizio).
update apartments
set contatto_nome = coalesce(contatto_nome, 'Host SLEPBOLO'),
    contatto_telefono = coalesce(contatto_telefono, '+39 051 000000')
where host_id = '00000000-0000-0000-0000-0000000000aa';
