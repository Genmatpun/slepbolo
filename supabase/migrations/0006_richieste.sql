-- ============================================================
-- SLEPBOLO — Proposte di appartamento dagli utenti (con approvazione)
-- Un utente loggato propone una casa -> arriva come "richiesta" ->
-- il proprietario la vede in admin e la pubblica o la rifiuta.
-- ============================================================

-- Chi può gestire l'admin (email autorizzate)
create table if not exists admins (
  email text primary key
);
alter table admins enable row level security;
-- nessuna policy di lettura pubblica: la tabella si consulta solo
-- tramite la funzione is_admin() qui sotto (security definer).

-- L'utente corrente è admin? (usa l'email nel token)
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from admins where email = (auth.jwt() ->> 'email'));
$$;

-- Richieste: tutti i dati del modulo in un campo JSON flessibile
create table if not exists richieste (
  id           uuid primary key default gen_random_uuid(),
  submitted_by uuid references profiles (id) on delete set null,
  dati         jsonb not null,
  stato        text not null default 'in_attesa', -- in_attesa | pubblicato | rifiutato
  created_at   timestamptz not null default now()
);
alter table richieste enable row level security;

create policy "utente invia una richiesta" on richieste
  for insert to authenticated
  with check (submitted_by = auth.uid());

create policy "utente vede le proprie richieste" on richieste
  for select using (submitted_by = auth.uid() or is_admin());

create policy "admin aggiorna le richieste" on richieste
  for update using (is_admin());

create policy "admin elimina le richieste" on richieste
  for delete using (is_admin());

-- ============================================================
-- IMPORTANTE: dopo aver eseguito questo file, autorizza te stesso:
--   insert into admins (email) values ('LA-TUA-EMAIL-ADMIN');
-- (la stessa email con cui entri in /admin)
-- ============================================================
