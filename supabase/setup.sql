-- ============================================================
-- SLEPBOLO — SETUP COMPLETO (schema + sicurezza + realtime + storage)
-- Generato da 0001/0002/0003. Incolla tutto nel SQL Editor di Supabase ed esegui.
-- Poi, opzionale, esegui supabase/seed.sql per i 12 annunci di esempio.
-- ============================================================


-- >>> supabase/migrations/0001_schema.sql

-- ============================================================
-- SLEPBOLO â€” Schema iniziale
-- Postgres / Supabase. Tutte le tabelle in RLS (vedi 0002_rls.sql).
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- ENUM ----------
create type genere_casa as enum ('ragazze', 'ragazzi', 'misto', 'indifferente');
create type tipo_stanza as enum ('singola', 'doppia');
create type stato_stanza as enum ('libera', 'in_trattativa', 'occupata');
create type stato_candidatura as enum ('inviata', 'letta', 'accettata', 'rifiutata');
create type motivo_segnalazione as enum (
  'caparra_anticipata', 'annuncio_inesistente', 'prezzo_diverso'
);

-- ---------- PROFILES ----------
create table profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  nome             text not null,
  cognome          text,
  eta              int check (eta between 16 and 99),
  corso_laurea     text,
  anno             text,
  sede_principale  text,
  genere           text,
  bio              text,
  foto_url         text,
  abitudini        text[] not null default '{}',
  budget_max       int check (budget_max is null or budget_max >= 0),
  verificato_unibo boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ---------- APARTMENTS ----------
create table apartments (
  id              uuid primary key default gen_random_uuid(),
  host_id         uuid not null references profiles (id) on delete cascade,
  titolo          text not null,
  descrizione     text,
  zona            text not null,
  via             text,
  lat             double precision,
  lng             double precision,
  piano           text,
  genere          genere_casa not null default 'misto',
  camere_totali   int not null check (camere_totali between 1 and 12),
  camere_occupate int not null default 0,
  servizi         text[] not null default '{}',
  regole          text[] not null default '{}',
  contratto_tipo  text,
  cauzione        text,
  attivo          boolean not null default true,
  created_at      timestamptz not null default now(),
  -- Vincolo di dominio: le occupate non possono superare (o pareggiare male) le totali.
  constraint camere_valide check (camere_occupate >= 0 and camere_occupate < camere_totali)
);

create index apartments_zona_idx on apartments (zona) where attivo;
create index apartments_host_idx on apartments (host_id);

-- ---------- ROOMS ----------
create table rooms (
  id                    uuid primary key default gen_random_uuid(),
  apartment_id          uuid not null references apartments (id) on delete cascade,
  tipo                  tipo_stanza not null default 'singola',
  prezzo_mensile        int not null check (prezzo_mensile >= 0),
  spese_incluse         boolean not null default false,
  spese_stimate         int check (spese_stimate is null or spese_stimate >= 0),
  disponibile_dal       date,
  permanenza_minima_mesi int not null default 6 check (permanenza_minima_mesi between 1 and 24),
  stato                 stato_stanza not null default 'libera',
  created_at            timestamptz not null default now()
);

create index rooms_apartment_idx on rooms (apartment_id);
create index rooms_stato_idx on rooms (stato);

-- ---------- HOUSEMATES ----------
-- profile_id nullable: l'host descrive i coinquilini anche se non iscritti.
create table housemates (
  id               uuid primary key default gen_random_uuid(),
  apartment_id     uuid not null references apartments (id) on delete cascade,
  profile_id       uuid references profiles (id) on delete set null,
  nome_visualizzato text not null,
  eta              int check (eta between 16 and 99),
  corso            text,
  genere           text
);

create index housemates_apartment_idx on housemates (apartment_id);

-- ---------- APPLICATIONS ----------
create table applications (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms (id) on delete cascade,
  student_id  uuid not null references profiles (id) on delete cascade,
  messaggio   text,
  stato       stato_candidatura not null default 'inviata',
  created_at  timestamptz not null default now(),
  unique (room_id, student_id)
);

create index applications_student_idx on applications (student_id);
create index applications_room_idx on applications (room_id);

-- ---------- MESSAGES ----------
create table messages (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications (id) on delete cascade,
  sender_id      uuid not null references profiles (id) on delete cascade,
  testo          text not null,
  letto_at       timestamptz,
  created_at     timestamptz not null default now()
);

create index messages_application_idx on messages (application_id, created_at);

-- ---------- SAVED ROOMS ----------
create table saved_rooms (
  student_id uuid not null references profiles (id) on delete cascade,
  room_id    uuid not null references rooms (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, room_id)
);

-- ---------- REPORTS (segnalazioni) ----------
create table reports (
  id           uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references apartments (id) on delete cascade,
  reporter_id  uuid references profiles (id) on delete set null,
  motivo       motivo_segnalazione not null,
  dettaglio    text,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- Trigger: crea automaticamente un profilo alla registrazione,
-- e imposta il badge verificato per le mail @studio.unibo.it.
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, verificato_unibo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email ilike '%@studio.unibo.it'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- Vista pubblica di ricerca: solo appartamenti attivi
-- con almeno una stanza libera.
-- ============================================================
create view apartments_in_ricerca as
select a.*
from apartments a
where a.attivo
  and exists (
    select 1 from rooms r
    where r.apartment_id = a.id and r.stato = 'libera'
  );


-- >>> supabase/migrations/0002_rls.sql

-- ============================================================
-- SLEPBOLO â€” Row Level Security
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

-- ---------- Helper: l'utente Ã¨ host dell'appartamento di questa stanza? ----------
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
-- ROOMS â€” leggibili se l'appartamento Ã¨ visibile; scrittura solo dell'host.
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
-- HOUSEMATES â€” stesse regole delle stanze.
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
-- APPLICATIONS â€” visibili e gestibili solo dai due coinvolti.
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
-- MESSAGES â€” solo i due utenti della candidatura.
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
-- SAVED ROOMS â€” solo lo studente proprietario.
-- ============================================================
create policy "gestisco i miei salvati" on saved_rooms
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ============================================================
-- REPORTS â€” chiunque autenticato segnala; nessuna lettura pubblica.
-- ============================================================
create policy "utenti autenticati segnalano" on reports
  for insert with check (auth.uid() is not null);


-- >>> supabase/migrations/0003_realtime_storage.sql

-- ============================================================
-- SLEPBOLO â€” Realtime per la chat + Storage per le foto
-- ============================================================

-- ---------- Realtime sui messaggi ----------
-- Abilita gli eventi INSERT in tempo reale sulla tabella messages,
-- cosÃ¬ la chat si aggiorna senza ricaricare (rispettando comunque la RLS).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;

-- ---------- Bucket foto ----------
insert into storage.buckets (id, name, public)
values ('foto', 'foto', true)
on conflict (id) do nothing;

-- Lettura pubblica delle foto (bucket pubblico).
create policy "foto leggibili da tutti" on storage.objects
  for select using (bucket_id = 'foto');

-- Ogni utente autenticato carica solo nella propria cartella (nome = suo id).
create policy "carico le mie foto" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'foto' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "gestisco le mie foto" on storage.objects
  for update to authenticated
  using (bucket_id = 'foto' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "elimino le mie foto" on storage.objects
  for delete to authenticated
  using (bucket_id = 'foto' and (storage.foldername(name))[1] = auth.uid()::text);

