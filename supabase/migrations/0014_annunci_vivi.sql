-- ============================================================
-- SLEPBOLO — Annunci vivi, contatti protetti, dati più ricchi
--
-- 1. CONTATTI E INDIRIZZO PROTETTI
--    Fino a qui telefono, WhatsApp, email e via stavano sulla tabella
--    apartments, leggibile da chiunque con la chiave pubblica: bastava
--    aprire /app senza login per averli tutti. Ora stanno in
--    annunci_privati, leggibile solo da: l'host, l'admin, e chi è
--    entrato con una mail @studio.unibo.it.
--    Le coordinate pubbliche vengono arrotondate a una griglia di circa
--    280 m: la mappa resta utile, l'indirizzo preciso no. Quelle esatte
--    restano in annunci_privati.
--
-- 2. CICLO DI VITA
--    aggiornato_il si muove da solo a ogni modifica (anche di una stanza).
--    confermato_il lo muove l'host con "Ancora libera": la ricerca nasconde
--    gli annunci non confermati da 14 giorni (filtro in src/lib/data.ts).
--
-- 3. DATI CHE GLI ANNUNCI VERI USANO
--    posti letto, cosa comprendono le spese, disponibilità fino a,
--    bagni, preferenze della casa, cosa c'è vicino, link a foto esterne,
--    contratto tramite agenzia. Profilo: studente-lavoratore, lingue,
--    più zone, da quando serve la stanza.
--
-- 4. BACHECA "CERCO"
--    Chi cerca una stanza pubblica un annuncio di sé. Lo vedono solo gli
--    studenti UniBo entrati con la mail istituzionale.
--
-- Rieseguibile: ogni passo controlla se è già stato fatto.
-- ============================================================

-- ---------- funzioni di servizio ----------

-- È uno studente UniBo entrato con la mail istituzionale?
-- La mail viene dal token firmato da Supabase, non da un campo modificabile.
create or replace function is_unibo()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'email') ilike '%@studio.unibo.it', false);
$$;

-- Arrotonda una coordinata al centro della cella di una griglia.
create or replace function coord_approssimata(v double precision, passo double precision)
returns double precision
language sql
immutable
as $$
  select case when v is null then null else (floor(v / passo) * passo + passo / 2) end;
$$;


-- ============================================================
-- 1. ANNUNCI PRIVATI: contatti, via, coordinate esatte
-- ============================================================
create table if not exists annunci_privati (
  apartment_id      uuid primary key references apartments (id) on delete cascade,
  contatto_nome     text,
  contatto_telefono text,
  contatto_whatsapp text,
  contatto_email    text,
  contatto_note     text,
  via               text,
  lat               double precision,
  lng               double precision
);

alter table annunci_privati enable row level security;

drop policy if exists "leggo i contatti" on annunci_privati;
create policy "leggo i contatti" on annunci_privati
  for select using (
    is_admin()
    or exists (select 1 from apartments a where a.id = apartment_id and a.host_id = auth.uid())
    or (is_unibo() and exists (select 1 from apartments a where a.id = apartment_id and a.attivo))
  );

drop policy if exists "host gestisce i contatti" on annunci_privati;
create policy "host gestisce i contatti" on annunci_privati
  for all using (
    is_admin()
    or exists (select 1 from apartments a where a.id = apartment_id and a.host_id = auth.uid())
  ) with check (
    is_admin()
    or exists (select 1 from apartments a where a.id = apartment_id and a.host_id = auth.uid())
  );

-- Copia i dati esistenti, solo se le vecchie colonne ci sono ancora.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'apartments' and column_name = 'contatto_telefono'
  ) then
    insert into annunci_privati (
      apartment_id, contatto_nome, contatto_telefono, contatto_whatsapp,
      contatto_email, contatto_note, via, lat, lng
    )
    select id, contatto_nome, contatto_telefono, contatto_whatsapp,
           contatto_email, contatto_note, via, lat, lng
    from apartments
    on conflict (apartment_id) do nothing;
  end if;
end $$;

-- La vista non è usata dal codice, ma dipende dalle colonne che togliamo.
drop view if exists apartments_in_ricerca;

alter table apartments
  drop column if exists contatto_nome,
  drop column if exists contatto_telefono,
  drop column if exists contatto_whatsapp,
  drop column if exists contatto_email,
  drop column if exists contatto_note,
  drop column if exists via;

-- Coordinate pubbliche sempre approssimate, anche se qualcuno scrive
-- quelle esatte direttamente su apartments.
create or replace function approssima_coordinate()
returns trigger
language plpgsql
as $$
begin
  new.lat := coord_approssimata(new.lat, 0.0025);
  new.lng := coord_approssimata(new.lng, 0.0035);
  return new;
end;
$$;

drop trigger if exists apartments_approssima on apartments;
create trigger apartments_approssima
  before insert or update of lat, lng on apartments
  for each row execute function approssima_coordinate();

-- Arrotonda anche le coordinate già salvate (le esatte sono già al sicuro
-- in annunci_privati). L'update fa scattare il trigger qui sopra.
update apartments set lat = lat, lng = lng where lat is not null or lng is not null;

create view apartments_in_ricerca as
select a.*
from apartments a
where a.attivo
  and exists (select 1 from rooms r where r.apartment_id = a.id and r.stato = 'libera');


-- ============================================================
-- 2. CICLO DI VITA
-- ============================================================
alter table apartments
  add column if not exists aggiornato_il timestamptz not null default now(),
  add column if not exists confermato_il timestamptz not null default now();

alter table rooms
  add column if not exists aggiornato_il timestamptz not null default now();

create index if not exists apartments_confermato_idx on apartments (confermato_il) where attivo;

create or replace function tocca_aggiornato()
returns trigger
language plpgsql
as $$
begin
  new.aggiornato_il := now();
  return new;
end;
$$;

drop trigger if exists apartments_aggiornato on apartments;
create trigger apartments_aggiornato
  before update on apartments
  for each row execute function tocca_aggiornato();

drop trigger if exists rooms_aggiornato on rooms;
create trigger rooms_aggiornato
  before update on rooms
  for each row execute function tocca_aggiornato();

-- Quando cambia una stanza, anche l'annuncio risulta aggiornato.
-- security definer: tocca solo la data, anche se chi modifica la stanza
-- è l'admin e non l'host.
create or replace function tocca_appartamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update apartments set aggiornato_il = now()
  where id = coalesce(new.apartment_id, old.apartment_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists rooms_tocca_appartamento on rooms;
create trigger rooms_tocca_appartamento
  after insert or update or delete on rooms
  for each row execute function tocca_appartamento();


-- ============================================================
-- 3. DATI PIÙ RICCHI
-- ============================================================
alter table rooms
  add column if not exists posti_liberi      int not null default 1,
  add column if not exists spese_comprendono text[] not null default '{}',
  add column if not exists disponibile_fino  date,
  add column if not exists nota              text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rooms_posti_liberi_check') then
    alter table rooms add constraint rooms_posti_liberi_check check (posti_liberi between 1 and 6);
  end if;
end $$;

alter table apartments
  add column if not exists bagni           int,
  add column if not exists preferenze      text[] not null default '{}',
  add column if not exists vicino_a        text,
  add column if not exists link_foto       text,
  add column if not exists tramite_agenzia boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'apartments_bagni_check') then
    alter table apartments add constraint apartments_bagni_check check (bagni is null or bagni between 1 and 6);
  end if;
  -- solo link https: niente javascript: o simili dentro un annuncio
  if not exists (select 1 from pg_constraint where conname = 'apartments_link_foto_check') then
    alter table apartments add constraint apartments_link_foto_check
      check (link_foto is null or link_foto ~* '^https://');
  end if;
end $$;

alter table profiles
  add column if not exists studente_lavoratore boolean not null default false,
  add column if not exists lingue              text[] not null default '{}',
  add column if not exists zone_preferite      text[] not null default '{}',
  add column if not exists cerco_dal           date;

-- La zona preferita singola diventa la prima delle zone preferite.
update profiles
set zone_preferite = array[zona_preferita]
where zona_preferita is not null and cardinality(zone_preferite) = 0;

-- Il badge "verificato UniBo" lo mette il sistema alla registrazione:
-- l'utente può modificare il suo profilo, ma non quel campo.
revoke update on profiles from anon, authenticated;
grant update (
  nome, cognome, eta, corso_laurea, anno, sede_principale, genere, bio,
  foto_url, abitudini, budget_max, zona_preferita, zone_preferite,
  studente_lavoratore, lingue, cerco_dal
) on profiles to authenticated;

-- I profili non sono più pubblici. Prima nome, cognome, età e foto di ogni
-- iscritto si leggevano senza login. Ora li vedono: la persona stessa,
-- l'admin, e l'host di una stanza a cui quella persona si è candidata
-- (serve alla pagina /candidature del sito). I coinquilini mostrati negli
-- annunci vengono dalla tabella housemates, senza nomi: non cambia niente.
drop policy if exists "profili leggibili" on profiles;
create policy "profili leggibili" on profiles
  for select using (
    id = auth.uid()
    or is_admin()
    or exists (
      select 1 from applications ap
      where ap.student_id = profiles.id and is_host_of_room(ap.room_id)
    )
  );

-- Pubblica una casa solo chi è entrato con la mail UniBo (o l'admin, che
-- ha già la sua regola). Prima bastava un account qualsiasi creato via API.
drop policy if exists "host crea appartamenti" on apartments;
create policy "host crea appartamenti" on apartments
  for insert with check (host_id = auth.uid() and is_unibo());


-- Segnalazioni: due motivi che nei gruppi capitano ogni giorno.
alter type motivo_segnalazione add value if not exists 'gia_presa';
alter type motivo_segnalazione add value if not exists 'agenzia';
alter type motivo_segnalazione add value if not exists 'altro';


-- ============================================================
-- 4. BACHECA "CERCO"
-- ============================================================
-- Nome, età e corso sono copiati qui quando la persona pubblica, e sono
-- tutto ciò che gli altri vedono di lei: il profilo resta privato.
create table if not exists cerco (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null unique references profiles (id) on delete cascade,
  nome          text not null check (char_length(nome) between 1 and 40),
  eta           int check (eta is null or eta between 16 and 99),
  genere        text,
  corso         text check (corso is null or char_length(corso) <= 80),
  anno          text,
  lavoratore    boolean not null default false,
  testo         text not null check (char_length(testo) between 10 and 600),
  zone          text[] not null default '{}',
  budget_max    int check (budget_max is null or budget_max between 0 and 3000),
  dal           date,
  tipo          text check (tipo is null or tipo in ('singola', 'doppia', 'posto_letto', 'indifferente')),
  contatto      text check (contatto is null or char_length(contatto) <= 120),
  attivo        boolean not null default true,
  confermato_il timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists cerco_attivo_idx on cerco (confermato_il) where attivo;

alter table cerco enable row level security;

drop policy if exists "studenti leggono la bacheca" on cerco;
create policy "studenti leggono la bacheca" on cerco
  for select using (
    profile_id = auth.uid() or is_admin() or (attivo and is_unibo())
  );

drop policy if exists "scrivo il mio cerco" on cerco;
create policy "scrivo il mio cerco" on cerco
  for all using (profile_id = auth.uid() or is_admin())
  with check ((profile_id = auth.uid() and is_unibo()) or is_admin());


-- ============================================================
-- 5. "INCOLLA DA WHATSAPP": limite giornaliero
--    Ogni compilazione automatica è una chiamata a un modello di Claude,
--    e costa. Massimo 20 al giorno a testa: per pubblicare bastano e
--    avanzano, per abusarne no. La tabella non ha regole di lettura:
--    si tocca solo da questa funzione.
-- ============================================================
create table if not exists estrazioni_uso (
  user_id uuid not null references auth.users (id) on delete cascade,
  giorno  date not null default current_date,
  n       int  not null default 0,
  primary key (user_id, giorno)
);

alter table estrazioni_uso enable row level security;

create or replace function usa_estrazione()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  conteggio int;
begin
  if auth.uid() is null or not (is_unibo() or is_admin()) then
    return false;
  end if;
  insert into estrazioni_uso (user_id, giorno, n)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, giorno) do update set n = estrazioni_uso.n + 1
  returning n into conteggio;
  return conteggio <= 20;
end;
$$;

revoke all on function usa_estrazione() from public, anon;
grant execute on function usa_estrazione() to authenticated;
