-- ============================================================
-- SLEPBOLO — Schema iniziale
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
