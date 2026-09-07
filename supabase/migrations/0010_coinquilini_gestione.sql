-- ============================================================
-- 0010 — I coinquilini CONFERMATI possono gestire l'annuncio
--   * un coinquilino che ha accettato (stato 'confermato') può
--     modificare / eliminare l'annuncio come l'host
--   * chiunque può rimuovere sé stesso dai coinquilini (uscire di casa)
--   * chi non ha accettato non ha alcun potere sull'annuncio
-- ============================================================

create or replace function public.is_membro_confermato(p_apartment uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from housemates h
    where h.apartment_id = p_apartment
      and h.profile_id = auth.uid()
      and h.stato = 'confermato'
  );
$$;

grant execute on function public.is_membro_confermato(uuid) to authenticated;

-- Gestione annuncio da parte dei coinquilini confermati
create policy "membro gestisce l'appartamento" on public.apartments
  for all using (is_membro_confermato(id)) with check (is_membro_confermato(id));

create policy "membro gestisce le stanze" on public.rooms
  for all using (is_membro_confermato(apartment_id)) with check (is_membro_confermato(apartment_id));

create policy "membro gestisce i coinquilini" on public.housemates
  for all using (is_membro_confermato(apartment_id)) with check (is_membro_confermato(apartment_id));

-- Ognuno può rimuovere sé stesso dall'elenco coinquilini (uscire dalla casa)
create policy "mi rimuovo dai coinquilini" on public.housemates
  for delete using (profile_id = auth.uid());
