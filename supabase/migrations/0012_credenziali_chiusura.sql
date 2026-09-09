-- ============================================================
-- SLEPBOLO — Chiude la lettura delle credenziali dal browser
--
-- Contesto: la pagina /admin/credenziali ora legge con la service role key,
-- lato server. Non ha piu' bisogno che qualcuno possa leggere la tabella da
-- un browser, quindi la policy di SELECT e' diventata solo superficie
-- d'attacco: chi ottenesse la sessione di quell'email si porterebbe via
-- tutte le password in chiaro con una sola richiesta.
--
-- Dopo questo file, la tabella `credenziali` non e' leggibile da NESSUN
-- client (anonimo o loggato, amministratore compreso). La legge solo il
-- server con la service role, che per definizione scavalca la RLS.
-- ============================================================

drop policy if exists "solo proprietario legge credenziali" on credenziali;

-- Nota: la policy di INSERT resta aperta ("with check (true)") perche' chi si
-- registra non e' ancora autenticato nel momento in cui salva la password.
-- Conseguenza accettata: chiunque puo' scrivere righe in questa tabella.
-- Non e' un furto di dati (non si puo' rileggere nulla) e le righe che non
-- corrispondono a un account vero non compaiono in /admin/credenziali,
-- perche' la pagina parte dagli utenti reali e ci aggancia le password.
