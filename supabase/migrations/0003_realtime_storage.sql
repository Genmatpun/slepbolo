-- ============================================================
-- SLEPBOLO — Realtime per la chat + Storage per le foto
-- ============================================================

-- ---------- Realtime sui messaggi ----------
-- Abilita gli eventi INSERT in tempo reale sulla tabella messages,
-- così la chat si aggiorna senza ricaricare (rispettando comunque la RLS).
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
