-- ============================================================
-- SLEPBOLO — Dati seed realistici (12 appartamenti, zone reali).
-- Prezzi tra 260 e 520 €, che è il mercato reale degli studenti.
-- ============================================================

-- Host demo. Inserimento diretto in auth.users con tutte le colonne che alcune
-- versioni di Supabase richiedono NOT NULL (token vuoti, metadata json).
-- Password demo: "password-demo".
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-0000000000aa',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'host.demo@studio.unibo.it',
  crypt('password-demo', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{"nome":"Host Demo"}',
  '', '', '', ''
) on conflict (id) do nothing;

-- Il trigger crea il profilo; assicuriamoci che esista comunque.
insert into profiles (id, nome, cognome, verificato_unibo)
values ('00000000-0000-0000-0000-0000000000aa', 'Host', 'Demo', true)
on conflict (id) do nothing;

-- ---------- Appartamenti ----------
-- Colonne: id, titolo, zona, via, lat, lng, piano, genere, tot, occ, servizi, contratto, cauzione, descrizione
insert into apartments (id, host_id, titolo, zona, via, lat, lng, piano, genere, camere_totali, camere_occupate, servizi, contratto_tipo, cauzione, descrizione) values
('a0000001-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000aa','Singola in trilocale a due passi da Zamboni','Zamboni','Via Mascarella',44.4972,11.3535,'2° senza ascensore','misto',3,2,'{"Wi-Fi","Lavatrice","Arredata","Contratto registrato","Balcone"}','Registrato — studenti (3+2)','2 mensilità','Secondo piano in una traversa di via Mascarella. Cinque minuti a piedi da via Zamboni. Casa tranquilla ma non silenziosa: si cena spesso insieme.'),
('a0000002-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000aa','Doppia in appartamento nuovo in Bolognina','Bolognina','Via Fioravanti',44.5105,11.3448,'4° con ascensore','misto',4,2,'{"Wi-Fi","Lavatrice","Lavastoviglie","Arredata","Aria condizionata","Bici/garage","Contratto registrato"}','Registrato — transitorio','1 mensilità','Palazzina ristrutturata vicino alla stazione. Due camere ancora libere su quattro. Ottimo se studi a Terracini: dieci minuti di bici in piano.'),
('a0000003-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000aa','Singola solo ragazze in Santo Stefano','Santo Stefano','Via Castiglione',44.4885,11.3486,'1° senza ascensore','ragazze',3,2,'{"Wi-Fi","Lavatrice","Arredata","Balcone","Contratto registrato"}','Registrato — studenti (3+2)','2 mensilità','Zona bellissima e silenziosa sotto i portici di Castiglione. Casa ordinata, si studia molto. Cerchiamo una ragazza per almeno un anno accademico.'),
('a0000004-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000aa','Stanza in quadrilocale zona Massarenti','Massarenti','Via Massarenti',44.4892,11.3652,'3° con ascensore','misto',4,3,'{"Wi-Fi","Lavatrice","Arredata","Balcone","Bici/garage"}','Registrato — transitorio','1 mensilità','Ultima camera libera. Casa di studenti dell''area medica, il Sant''Orsola è dietro l''angolo. Turni e orari strani sono la normalità qui.'),
('a0000005-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000aa','Due singole in casa indipendente a Murri','Murri','Via Murri',44.4795,11.3558,'Villetta su due livelli','misto',5,3,'{"Wi-Fi","Lavatrice","Lavastoviglie","Arredata","Balcone","Ammessi animali","Bici/garage"}','Registrato — studenti (3+2)','2 mensilità','Casa con giardino e tavolo grande. Due camere libere insieme, ideale se cercate in due. Un po'' fuori dal centro ma la 13 passa ogni cinque minuti.'),
('a0000006-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000aa','Singola economica in Cirenaica','Cirenaica','Via Libia',44.4932,11.3682,'1° senza ascensore','ragazzi',3,2,'{"Wi-Fi","Lavatrice","Arredata","Si può fumare"}','Da concordare','1 mensilità','Camera libera anche per pochi mesi, perfetta per un semestre. Quartiere vivo, mercato sotto casa, birreria all''angolo.'),
('a0000007-0000-0000-0000-000000000007','00000000-0000-0000-0000-0000000000aa','Camera luminosa in Saragozza','Saragozza','Via Saragozza',44.4878,11.3332,'3° con ascensore','ragazze',4,1,'{"Wi-Fi","Lavatrice","Lavastoviglie","Arredata","Balcone","Aria condizionata","Contratto registrato"}','Registrato — studenti (3+2)','2 mensilità','Appartamento appena ristrutturato: tre camere ancora da riempire, quindi si sceglie insieme chi entra. Sotto i portici di San Luca.'),
('a0000008-0000-0000-0000-000000000008','00000000-0000-0000-0000-0000000000aa','Posto in doppia low cost a San Donato','San Donato','Via San Donato',44.5092,11.3722,'5° con ascensore','ragazzi',4,3,'{"Wi-Fi","Lavatrice","Arredata","Bici/garage"}','Registrato — transitorio','1 mensilità','Il prezzo più basso della zona, camera doppia con l''altro posto già occupato. Autobus 25 diretto per Terracini, oppure venti minuti di bici.'),
('a0000009-0000-0000-0000-000000000009','00000000-0000-0000-0000-0000000000aa','Singola silenziosa a Porta Saffi','Porta Saffi','Via Andrea Costa',44.4902,11.3205,'2° con ascensore','misto',3,1,'{"Wi-Fi","Lavatrice","Arredata","Balcone","Contratto registrato"}','Registrato — transitorio','1 mensilità','Casa tranquilla, chi ci abita lavora in dipartimento e sta fuori tutto il giorno. Due camere libere da gennaio, buona per il secondo semestre.'),
('a0000010-0000-0000-0000-000000000010','00000000-0000-0000-0000-0000000000aa','Stanza in casa grande al Navile','Navile','Via di Corticella',44.5248,11.3520,'Piano terra con corte','misto',5,4,'{"Wi-Fi","Lavatrice","Arredata","Ammessi animali","Si può fumare","Bici/garage"}','Da concordare','Nessuna','Casa rumorosa nel senso bello: cene, gente che passa, un gatto. Ultima camera. Se cerchi silenzio assoluto non è il posto giusto.'),
('a0000011-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000aa','Singola in bilocale condiviso zona Fiera','Fiera','Via Stalingrado',44.5148,11.3625,'6° con ascensore','ragazze',2,1,'{"Wi-Fi","Lavatrice","Lavastoviglie","Arredata","Aria condizionata","Balcone","Contratto registrato"}','Registrato — transitorio','1 mensilità','Solo in due in casa, quindi bagno quasi sempre libero. Palazzo moderno con portineria. Va bene per chi vuole studiare senza troppo caos.'),
('a0000012-0000-0000-0000-000000000012','00000000-0000-0000-0000-0000000000aa','Due camere in villetta alla Barca','Barca','Via Tolmino',44.4872,11.3025,'Villetta con giardino','misto',4,2,'{"Wi-Fi","Lavatrice","Arredata","Balcone","Ammessi animali","Bici/garage"}','Registrato — studenti (3+2)','1 mensilità','Zona residenziale, aria buona e affitti bassi. Il Treno della Barca è a due passi. Serve la bici o il 21, ma si risparmiano cento euro al mese.');

-- ---------- Stanze libere ----------
-- Una riga "libera" per ogni camera non ancora occupata, col prezzo di zona.
with prezzi(aid, prezzo, tipo, spese_incl, spese_stim, dal, minmesi) as (values
  ('a0000001-0000-0000-0000-000000000001'::uuid, 480, 'singola'::tipo_stanza, true,  null, date '2026-09-01', 12),
  ('a0000002-0000-0000-0000-000000000002'::uuid, 290, 'doppia',  false, 50, date '2026-10-01', 6),
  ('a0000003-0000-0000-0000-000000000003'::uuid, 520, 'singola', true,  null, date '2026-09-01', 12),
  ('a0000004-0000-0000-0000-000000000004'::uuid, 360, 'singola', false, 50, date '2026-09-01', 6),
  ('a0000005-0000-0000-0000-000000000005'::uuid, 420, 'singola', false, 80, date '2026-10-01', 12),
  ('a0000006-0000-0000-0000-000000000006'::uuid, 330, 'singola', true,  null, date '2026-08-20', 3),
  ('a0000007-0000-0000-0000-000000000007'::uuid, 450, 'singola', false, 50, date '2026-09-01', 12),
  ('a0000008-0000-0000-0000-000000000008'::uuid, 260, 'doppia',  true,  null, date '2026-10-01', 6),
  ('a0000009-0000-0000-0000-000000000009'::uuid, 390, 'singola', false, 50, date '2027-01-01', 6),
  ('a0000010-0000-0000-0000-000000000010'::uuid, 300, 'singola', true,  null, date '2026-08-20', 3),
  ('a0000011-0000-0000-0000-000000000011'::uuid, 410, 'singola', true,  null, date '2026-09-01', 6),
  ('a0000012-0000-0000-0000-000000000012'::uuid, 280, 'singola', false, 50, date '2026-10-01', 12)
)
insert into rooms (apartment_id, tipo, prezzo_mensile, spese_incluse, spese_stimate, disponibile_dal, permanenza_minima_mesi, stato)
select a.id, p.tipo, p.prezzo, p.spese_incl, p.spese_stim, p.dal, p.minmesi, 'libera'
from apartments a
join prezzi p on p.aid = a.id
cross join generate_series(1, a.camere_totali - a.camere_occupate);

-- ---------- Coinquilini ----------
insert into housemates (apartment_id, nome_visualizzato, eta, corso) values
('a0000001-0000-0000-0000-000000000001','Giulia',23,'Lettere moderne'),
('a0000001-0000-0000-0000-000000000001','Marta',22,'Scienze politiche'),
('a0000002-0000-0000-0000-000000000002','Ahmed',24,'Ingegneria informatica'),
('a0000002-0000-0000-0000-000000000002','Luca',22,'Statistica'),
('a0000003-0000-0000-0000-000000000003','Sofia',25,'Medicina'),
('a0000003-0000-0000-0000-000000000003','Elena',24,'Giurisprudenza'),
('a0000004-0000-0000-0000-000000000004','Chiara',23,'Infermieristica'),
('a0000004-0000-0000-0000-000000000004','Ilaria',22,'Farmacia'),
('a0000004-0000-0000-0000-000000000004','Paolo',26,'Medicina'),
('a0000005-0000-0000-0000-000000000005','Federico',25,'Architettura'),
('a0000005-0000-0000-0000-000000000005','Anna',24,'Psicologia'),
('a0000005-0000-0000-0000-000000000005','Nikola',23,'Erasmus — Economia'),
('a0000006-0000-0000-0000-000000000006','Matteo',22,'Ingegneria energetica'),
('a0000006-0000-0000-0000-000000000006','Simone',23,'Informatica'),
('a0000007-0000-0000-0000-000000000007','Beatrice',24,'Farmacia'),
('a0000008-0000-0000-0000-000000000008','Youssef',21,'Ingegneria civile'),
('a0000008-0000-0000-0000-000000000008','Davide',22,'Ingegneria civile'),
('a0000008-0000-0000-0000-000000000008','Andrea',23,'Chimica'),
('a0000009-0000-0000-0000-000000000009','Riccardo',26,'Dottorando in Fisica'),
('a0000010-0000-0000-0000-000000000010','Sara',24,'DAMS'),
('a0000010-0000-0000-0000-000000000010','Tommaso',25,'Antropologia'),
('a0000010-0000-0000-0000-000000000010','Lea',23,'Erasmus — DAMS'),
('a0000010-0000-0000-0000-000000000010','Gio',27,'Fuori corso, lavora'),
('a0000011-0000-0000-0000-000000000011','Valentina',26,'Magistrale in Economia'),
('a0000012-0000-0000-0000-000000000012','Emanuele',23,'Agraria'),
('a0000012-0000-0000-0000-000000000012','Nicolò',22,'Scienze motorie');
