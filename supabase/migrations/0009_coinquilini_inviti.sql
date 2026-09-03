-- ============================================================
-- 0009 — Coinquilini registrati + inviti con scadenza 24h
--
-- Modello:
--   * "manuale"      -> dati inseriti a mano (non iscritto), stato 'confermato'
--   * "invitato"     -> collegato a un profilo reale via mail UniBo:
--                       compare SUBITO (snapshot dati profilo), stato 'in_attesa',
--                       ha 24h per accettare, altrimenti sparisce (filtro a lettura).
-- ============================================================

alter table public.housemates
  add column if not exists stato text not null default 'confermato',      -- 'confermato' | 'in_attesa'
  add column if not exists scadenza_invito timestamptz,                    -- solo per invitati
  add column if not exists invitato_da uuid references auth.users (id) on delete set null;

-- Un utente può sempre vedere i propri inviti (anche su annunci non attivi).
drop policy if exists "vedo i miei inviti" on public.housemates;
create policy "vedo i miei inviti" on public.housemates
  for select using (profile_id = auth.uid());

-- ------------------------------------------------------------
-- INVITA: chiamabile dall'host della casa o da un admin.
-- Aggiunge subito il coinquilino (snapshot dal suo profilo) in stato 'in_attesa'
-- con scadenza a 24h. La persona poi accetta o viene rimossa.
-- ------------------------------------------------------------
create or replace function public.invita_coinquilino(p_apartment uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid;
  v_prof profiles%rowtype;
begin
  if not exists (
    select 1 from apartments a
    where a.id = p_apartment and (a.host_id = auth.uid() or is_admin())
  ) then
    return 'non_autorizzato';
  end if;

  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then
    return 'non_trovato';
  end if;

  if exists (
    select 1 from housemates
    where apartment_id = p_apartment and profile_id = v_uid and stato <> 'rifiutato'
  ) then
    return 'gia_presente';
  end if;

  select * into v_prof from profiles where id = v_uid;

  insert into housemates (apartment_id, profile_id, nome_visualizzato, genere, eta, corso, abitudini, stato, scadenza_invito, invitato_da)
  values (
    p_apartment, v_uid, null,
    v_prof.genere, v_prof.eta, v_prof.corso_laurea, coalesce(v_prof.abitudini, '{}'),
    'in_attesa', now() + interval '24 hours', auth.uid()
  );

  return 'ok';
end;
$$;

-- ------------------------------------------------------------
-- RISPONDI: l'invitato accetta (aggiorna lo snapshot e conferma)
-- oppure rifiuta (rimuove la riga).
-- ------------------------------------------------------------
create or replace function public.rispondi_invito(p_housemate uuid, p_accetta boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof profiles%rowtype;
begin
  if not exists (
    select 1 from housemates
    where id = p_housemate and profile_id = auth.uid() and stato = 'in_attesa'
  ) then
    return 'non_valido';
  end if;

  if not p_accetta then
    delete from housemates where id = p_housemate;
    return 'rifiutato';
  end if;

  select * into v_prof from profiles where id = auth.uid();

  update housemates set
    stato = 'confermato',
    scadenza_invito = null,
    genere = v_prof.genere,
    eta = v_prof.eta,
    corso = v_prof.corso_laurea,
    abitudini = coalesce(v_prof.abitudini, '{}')
  where id = p_housemate;

  return 'confermato';
end;
$$;

grant execute on function public.invita_coinquilino(uuid, text) to authenticated;
grant execute on function public.rispondi_invito(uuid, boolean) to authenticated;
