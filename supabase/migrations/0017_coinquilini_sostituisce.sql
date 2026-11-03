-- ============================================================
-- 0017 — L'invito accettato prende il posto del coinquilino descritto
--
-- Prima: chi pubblica descriveva un coinquilino a mano e poi lo invitava
-- con la mail; quando la persona accettava, nell'annuncio comparivano in
-- due (la descrizione e il profilo vero).
--
-- Ora l'invito può dire quale coinquilino descritto è quella persona
-- (colonna sostituisce):
--   * finché l'invito è in attesa, a lettura si mostra solo l'invitato
--     (il filtro sta nell'app, coinquiliniVisibili);
--   * se accetta, la descrizione viene cancellata;
--   * se rifiuta o l'invito scade, la descrizione resta com'era.
-- ============================================================

alter table public.housemates
  add column if not exists sostituisce uuid references public.housemates (id) on delete set null;

-- La firma cambia (terzo parametro facoltativo): la vecchia va tolta,
-- altrimenti una chiamata con due parametri sarebbe ambigua.
drop function if exists public.invita_coinquilino(uuid, text);

create or replace function public.invita_coinquilino(p_apartment uuid, p_email text, p_sostituisce uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid;
  v_prof profiles%rowtype;
  v_sost uuid;
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

  -- vale solo un coinquilino descritto a mano di questa stessa casa
  select h.id into v_sost from housemates h
  where h.id = p_sostituisce and h.apartment_id = p_apartment and h.profile_id is null;

  select * into v_prof from profiles where id = v_uid;

  insert into housemates (apartment_id, profile_id, nome_visualizzato, genere, eta, corso, abitudini, stato, scadenza_invito, invitato_da, sostituisce)
  values (
    p_apartment, v_uid, null,
    v_prof.genere, v_prof.eta, v_prof.corso_laurea, coalesce(v_prof.abitudini, '{}'),
    'in_attesa', now() + interval '24 hours', auth.uid(), v_sost
  );

  return 'ok';
end;
$$;

create or replace function public.rispondi_invito(p_housemate uuid, p_accetta boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof profiles%rowtype;
  v_riga housemates%rowtype;
begin
  select * into v_riga from housemates
  where id = p_housemate and profile_id = auth.uid() and stato = 'in_attesa';
  if not found then
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
    sostituisce = null,
    genere = v_prof.genere,
    eta = v_prof.eta,
    corso = v_prof.corso_laurea,
    abitudini = coalesce(v_prof.abitudini, '{}')
  where id = p_housemate;

  -- la descrizione fatta a mano di questa persona non serve più
  if v_riga.sostituisce is not null then
    delete from housemates
    where id = v_riga.sostituisce and apartment_id = v_riga.apartment_id and profile_id is null;
  end if;

  return 'confermato';
end;
$$;

grant execute on function public.invita_coinquilino(uuid, text, uuid) to authenticated;
grant execute on function public.rispondi_invito(uuid, boolean) to authenticated;
