-- ============================================================
-- 0015 — Passare un annuncio a un altro account
--
-- Chi pubblica un annuncio per conto di qualcuno (es. l'admin che carica
-- la casa di un host) può passarlo al suo account:
--   * l'host attuale scrive la mail con cui l'altra persona è registrata
--     -> nasce un passaggio "in attesa", valido 7 giorni
--   * la persona lo vede nel profilo e accetta (diventa host: modifica,
--     segna le stanze, conferma, elimina) oppure rifiuta
--   * un solo passaggio in attesa per annuncio; uno nuovo sostituisce il vecchio
-- Chi passa l'annuncio, dopo l'accettazione, non lo gestisce più.
-- ============================================================

create table if not exists public.passaggi_annuncio (
  apartment_id uuid primary key references public.apartments (id) on delete cascade,
  da           uuid not null references public.profiles (id) on delete cascade,
  a            uuid not null references public.profiles (id) on delete cascade,
  email_a      text not null,
  creato       timestamptz not null default now(),
  scade        timestamptz not null default now() + interval '7 days'
);

alter table public.passaggi_annuncio enable row level security;

-- Si vede solo un passaggio che ti riguarda; si crea e si accetta solo dalle funzioni qui sotto.
create policy "vedo i passaggi che mi riguardano" on public.passaggi_annuncio
  for select using (da = auth.uid() or a = auth.uid());

-- Chi passa può annullare, chi riceve può rifiutare.
create policy "annullo o rifiuto un passaggio" on public.passaggi_annuncio
  for delete using (da = auth.uid() or a = auth.uid());

-- ------------------------------------------------------------
-- PASSA: chiamabile dall'host dell'annuncio o da un admin.
-- ------------------------------------------------------------
create or replace function public.passa_annuncio(p_apartment uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_uid  uuid;
begin
  select host_id into v_host from apartments where id = p_apartment;
  if v_host is null or not (v_host = auth.uid() or is_admin()) then
    return 'non_autorizzato';
  end if;

  select u.id into v_uid
  from auth.users u
  join profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email));
  if v_uid is null then
    return 'non_trovato';
  end if;

  if v_uid = v_host then
    return 'gia_suo';
  end if;

  insert into passaggi_annuncio (apartment_id, da, a, email_a)
  values (p_apartment, auth.uid(), v_uid, lower(trim(p_email)))
  on conflict (apartment_id) do update set
    da = excluded.da,
    a = excluded.a,
    email_a = excluded.email_a,
    creato = now(),
    scade = now() + interval '7 days';

  return 'ok';
end;
$$;

-- ------------------------------------------------------------
-- IN ARRIVO: gli annunci che qualcuno ti sta passando, ancora validi.
-- (Serve una funzione: l'annuncio potrebbe essere nascosto, e allora
-- chi lo riceve non lo vedrebbe con le regole normali.)
-- ------------------------------------------------------------
create or replace function public.passaggi_in_arrivo()
returns table (apartment_id uuid, titolo text, zona text, da_nome text, scade timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select p.apartment_id, a.titolo, a.zona, pr.nome, p.scade
  from passaggi_annuncio p
  join apartments a on a.id = p.apartment_id
  left join profiles pr on pr.id = p.da
  where p.a = auth.uid() and p.scade > now()
  order by p.creato desc;
$$;

-- ------------------------------------------------------------
-- RISPONDI: chi riceve accetta (diventa host) o rifiuta.
-- ------------------------------------------------------------
create or replace function public.rispondi_passaggio(p_apartment uuid, p_accetta boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from passaggi_annuncio
    where apartment_id = p_apartment and a = auth.uid() and scade > now()
  ) then
    return 'non_valido';
  end if;

  if p_accetta then
    update apartments set host_id = auth.uid() where id = p_apartment;
  end if;

  delete from passaggi_annuncio where apartment_id = p_apartment;

  return case when p_accetta then 'accettato' else 'rifiutato' end;
end;
$$;

grant execute on function public.passa_annuncio(uuid, text) to authenticated;
grant execute on function public.passaggi_in_arrivo() to authenticated;
grant execute on function public.rispondi_passaggio(uuid, boolean) to authenticated;
