-- ============================================================
-- 0016 — Altri atenei + host abilitati a mano
--
-- 1. Studenti: oltre a @studio.unibo.it valgono anche
--    @studenti.unipr.it, @edu.unife.it, @studenti.unimore.it.
--    is_unibo() tiene il suo nome (lo usano già molte regole) ma ora vuol
--    dire "studente di un ateneo ammesso". Va tenuto allineato con
--    DOMINI_STUDENTI in src/lib/constants.ts.
-- 2. Host: chi affitta e non studia può registrarsi con una mail qualsiasi,
--    ma solo se l'admin l'ha messa in host_abilitati. Un host abilitato
--    può pubblicare e gestire i suoi annunci; non legge i contatti degli
--    altri annunci e non scrive nella bacheca "Cerco" (restano agli studenti).
-- ============================================================

-- ---------- 1. atenei ----------
create or replace function public.is_unibo()
returns boolean
language sql
stable
as $$
  select coalesce(
    split_part(lower(auth.jwt() ->> 'email'), '@', 2)
      in ('studio.unibo.it', 'studenti.unipr.it', 'edu.unife.it', 'studenti.unimore.it'),
    false
  );
$$;

create or replace function public.handle_new_user()
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
    split_part(lower(new.email), '@', 2)
      in ('studio.unibo.it', 'studenti.unipr.it', 'edu.unife.it', 'studenti.unimore.it')
  );
  return new;
end;
$$;

-- ---------- 2. host abilitati ----------
create table if not exists public.host_abilitati (
  email  text primary key check (email = lower(trim(email))),
  nota   text,
  creato timestamptz not null default now()
);

alter table public.host_abilitati enable row level security;

create policy "admin gestisce gli host abilitati" on public.host_abilitati
  for all using (is_admin()) with check (is_admin());

-- L'utente collegato è un host abilitato?
create or replace function public.is_host_abilitato()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from host_abilitati where email = lower(auth.jwt() ->> 'email')
  );
$$;

-- La schermata di registrazione chiede se una mail è abilitata prima di creare l'account.
-- Risponde solo sì o no, senza elencare nulla.
create or replace function public.mail_host_abilitata(p_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from host_abilitati where email = lower(trim(p_email))
  );
$$;

grant execute on function public.is_host_abilitato() to authenticated;
grant execute on function public.mail_host_abilitata(text) to anon, authenticated;

-- Pubblicare: studenti degli atenei ammessi oppure host abilitati.
drop policy if exists "host crea appartamenti" on public.apartments;
create policy "host crea appartamenti" on public.apartments
  for insert with check (host_id = auth.uid() and (is_unibo() or is_host_abilitato()));

-- "Incolla da WhatsApp": anche per gli host abilitati.
create or replace function public.usa_estrazione()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  conteggio int;
begin
  if auth.uid() is null or not (is_unibo() or is_host_abilitato() or is_admin()) then
    return false;
  end if;
  insert into estrazioni_uso (user_id, giorno, n)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, giorno) do update set n = estrazioni_uso.n + 1
  returning n into conteggio;
  return conteggio <= 20;
end;
$$;
