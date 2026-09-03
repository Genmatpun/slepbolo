-- 0008 — Privacy coinquilini
-- I coinquilini non mostrano più il nome: solo genere, età, corso e preferenze di vita.
-- Aggiunge la colonna "abitudini" e rende il nome opzionale.

alter table public.housemates
  add column if not exists abitudini text[] not null default '{}';

alter table public.housemates
  alter column nome_visualizzato drop not null;
