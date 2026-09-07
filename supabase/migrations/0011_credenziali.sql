-- ============================================================
-- SLEPBOLO — Credenziali degli iscritti (USO DIMOSTRATIVO)
--
-- ⚠️  Questa tabella salva email e password IN CHIARO delle persone
--     che si registrano. È una scelta esplicita per la fase di test,
--     dove tutti gli account sono di prova. NON usare con dati reali:
--     le password in chiaro sono un rischio grave (riuso su altri siti,
--     accesso a chi legge il DB). Per disattivare basta togliere la
--     scrittura in auth-form.tsx ed eliminare questa tabella.
--
-- Sicurezza minima applicata: la tabella è leggibile SOLO dal
-- proprietario (vedi policy di SELECT), non da tutti gli utenti loggati.
-- ============================================================

create table if not exists credenziali (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  email      text not null,
  password   text not null,
  created_at timestamptz not null default now()
);

create index if not exists credenziali_created_idx on credenziali (created_at desc);

alter table credenziali enable row level security;

-- INSERT: la registrazione avviene prima della conferma email, quindi
-- l'utente non è ancora autenticato. Consentiamo l'inserimento a tutti
-- (ruolo anon/authenticated). Non si può leggere ciò che si inserisce.
drop policy if exists "registrazione salva credenziali" on credenziali;
create policy "registrazione salva credenziali" on credenziali
  for insert with check (true);

-- SELECT: legge SOLO il proprietario.
-- 👉 Sostituisci/aggiungi qui la mail con cui accedi all'admin.
drop policy if exists "solo proprietario legge credenziali" on credenziali;
create policy "solo proprietario legge credenziali" on credenziali
  for select using (
    lower(auth.jwt() ->> 'email') in ('gennaiomat@gmail.com')
  );
