-- ============================================================
-- SLEPBOLO — Da dove arriva chi si iscrive
--
-- I link che pubblichiamo finiscono in ?da=tiktok, ?da=telegram, ?da=adesivo.
-- L'app scrive qui il nome del canale la prima volta che la persona apre
-- SLEPBOLO da registrata. Serve solo a capire su quale canale insistere.
--
-- Sta in una tabella a parte e non dentro "profiles" perché i profili sono
-- leggibili da chiunque: questo dato lo deve vedere solo l'admin.
-- ============================================================
create table if not exists provenienze (
  user_id   uuid primary key references auth.users on delete cascade,
  canale    text not null check (canale ~ '^[a-z0-9_-]{1,24}$'),
  creato_at timestamptz not null default now()
);

alter table provenienze enable row level security;

-- Ognuno scrive solo la propria, e una volta sola: ci pensa la chiave primaria.
create policy "scrivo la mia provenienza" on provenienze
  for insert with check (auth.uid() = user_id);

-- Rileggere la propria serve all'app per non ritentare a ogni apertura.
create policy "leggo la mia provenienza" on provenienze
  for select using (auth.uid() = user_id);

create policy "admin legge le provenienze" on provenienze
  for select using (is_admin());

comment on table provenienze is
  'Canale da cui è arrivato chi si è registrato (?da= nel link). Nessun dato personale.';
