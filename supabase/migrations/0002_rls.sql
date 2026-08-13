-- ============================================================
-- SLEPBOLO — Row Level Security
--   * chiunque legge gli appartamenti attivi e i loro dati collegati
--   * solo l'host modifica i propri appartamenti/stanze/coinquilini
--   * applications e messages: visibili solo ai due utenti coinvolti
-- ============================================================

alter table profiles     enable row level security;
alter table apartments   enable row level security;
alter table rooms        enable row level security;
alter table housemates   enable row level security;
alter table applications enable row level security;
alter table messages     enable row level security;
alter table saved_rooms  enable row level security;
alter table reports      enable row level security;

-- ---------- Helper: l'utente è host dell'appartamento di questa stanza? ----------
create or replace function is_host_of_room(p_room uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from rooms r
    join apartments a on a.id = r.apartment_id
    where r.id = p_room and a.host_id = auth.uid()
  );
$$;

-- ---------- Helper: l'utente partecipa alla candidatura? (host o studente) ----------
create or replace function partecipa_a_candidatura(p_app uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from applications app
    join rooms r on r.id = app.room_id
    join apartments a on a.id = r.apartment_id
    where app.id = p_app
      and (app.student_id = auth.uid() or a.host_id = auth.uid())
  );
$$;

-- ============================================================
-- PROFILES
-- Lettura pubblica (l'host deve vedere il profilo di chi si candida,
-- e i profili non contengono dati sensibili). Scrittura solo del proprio.
-- ============================================================
create policy "profili leggibili" on profiles
  for select using (true);

create policy "modifico il mio profilo" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "inserisco il mio profilo" on profiles
  for insert with check (auth.uid() = id);

-- ============================================================
-- APARTMENTS
-- ============================================================
create policy "appartamenti attivi pubblici" on apartments
  for select using (attivo or host_id = auth.uid());

create policy "host crea appartamenti" on apartments
  for insert with check (host_id = auth.uid());

create policy "host modifica i suoi appartamenti" on apartments
  for update using (host_id = auth.uid()) with check (host_id = auth.uid());

create policy "host elimina i suoi appartamenti" on apartments
  for delete using (host_id = auth.uid());

-- ============================================================
-- ROOMS — leggibili se l'appartamento è visibile; scrittura solo dell'host.
-- ============================================================
create policy "stanze leggibili" on rooms
  for select using (
    exists (
      select 1 from apartments a
      where a.id = apartment_id and (a.attivo or a.host_id = auth.uid())
    )
  );

create policy "host gestisce le stanze" on rooms
  for all using (
    exists (select 1 from apartments a where a.id = apartment_id and a.host_id = auth.uid())
  ) with check (
    exists (select 1 from apartments a where a.id = apartment_id and a.host_id = auth.uid())
  );

-- ============================================================
-- HOUSEMATES — stesse regole delle stanze.
-- ============================================================
create policy "coinquilini leggibili" on housemates
  for select using (
    exists (
      select 1 from apartments a
      where a.id = apartment_id and (a.attivo or a.host_id = auth.uid())
    )
  );

create policy "host gestisce i coinquilini" on housemates
  for all using (
    exists (select 1 from apartments a where a.id = apartment_id and a.host_id = auth.uid())
  ) with check (
    exists (select 1 from apartments a where a.id = apartment_id and a.host_id = auth.uid())
  );

-- ============================================================
-- APPLICATIONS — visibili e gestibili solo dai due coinvolti.
-- ============================================================
create policy "vedo le mie candidature" on applications
  for select using (
    student_id = auth.uid() or is_host_of_room(room_id)
  );

create policy "studente si candida" on applications
  for insert with check (student_id = auth.uid());

create policy "aggiorno candidatura se coinvolto" on applications
  for update using (
    student_id = auth.uid() or is_host_of_room(room_id)
  ) with check (
    student_id = auth.uid() or is_host_of_room(room_id)
  );

-- ============================================================
-- MESSAGES — solo i due utenti della candidatura.
-- ============================================================
create policy "leggo i messaggi delle mie candidature" on messages
  for select using (partecipa_a_candidatura(application_id));

create policy "scrivo se partecipo e sono il mittente" on messages
  for insert with check (
    sender_id = auth.uid() and partecipa_a_candidatura(application_id)
  );

create policy "segno letto se partecipo" on messages
  for update using (partecipa_a_candidatura(application_id));

-- ============================================================
-- SAVED ROOMS — solo lo studente proprietario.
-- ============================================================
create policy "gestisco i miei salvati" on saved_rooms
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ============================================================
-- REPORTS — chiunque autenticato segnala; nessuna lettura pubblica.
-- ============================================================
create policy "utenti autenticati segnalano" on reports
  for insert with check (auth.uid() is not null);
