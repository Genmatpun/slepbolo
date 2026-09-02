-- ============================================================
-- SLEPBOLO — L'annuncio è di chi lo propone
--   * l'admin può creare/gestire annunci a nome di chiunque (approva)
--   * ogni utente gestisce (e cancella) i PROPRI annunci (host_id = lui)
--     -> le policy "host ..." esistenti già lo consentono
-- ============================================================

create policy "admin gestisce tutti gli appartamenti" on apartments
  for all using (is_admin()) with check (is_admin());

create policy "admin gestisce tutte le stanze" on rooms
  for all using (is_admin()) with check (is_admin());

create policy "admin gestisce tutti i coinquilini" on housemates
  for all using (is_admin()) with check (is_admin());
