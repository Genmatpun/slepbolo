# Prompt per Claude Code — SLEPBOLO

> Copia tutto il blocco qui sotto e incollalo come primo messaggio in Claude Code,
> dentro una cartella vuota. Allega anche il file `index.html` del prototipo:
> serve come riferimento visivo per la palette e i componenti.

---

Costruisci **SLEPBOLO**, una web app per far incontrare studenti universitari di Bologna che cercano una stanza e chi ha camere libere in un appartamento condiviso.

Non è un portale di affitti brevi: il focus è **trovare il coinquilino giusto** per periodi da 3 mesi a un anno accademico. La differenza rispetto a Idealista o ai gruppi Facebook è che un annuncio mostra *chi abita già in casa*, non solo i metri quadri.

## Stack

- **Next.js 15** (App Router, TypeScript, Server Components dove ha senso)
- **Tailwind CSS** — configura i token del design system in `globals.css` con `@theme`, non usare valori arbitrari sparsi nel codice
- **Supabase** — Postgres, Auth, Storage per le foto, Row Level Security
- **shadcn/ui** per i componenti base (dialog, select, slider, form), restilizzati sulla nostra palette
- **react-hook-form + zod** per tutti i form
- **MapLibre GL + tile OpenStreetMap** per la mappa (niente Google Maps, niente API key a pagamento)
- Deploy su Vercel

Non aggiungere dipendenze oltre a queste senza dirmi prima perché servono.

## Design system — rispettalo alla lettera

Palette ispirata al logo dell'Università di Bologna. Solo questi colori, niente blu di sistema, niente grigi freddi:

```
--rosso:     #A2001D   /* primario: bottoni, link, accenti forti */
--rosso-scuro:#7A0016  /* hover del primario */
--arancio:   #E4572E   /* secondario: eyebrow, badge, evidenziazioni */
--crema:     #FAF3E7   /* sfondo pagina */
--carta:     #FFFDF9   /* sfondo di card, modali, input */
--inchiostro:#1B1815   /* testo principale */
--grigio:    #736B62   /* testo secondario */
--linea:     #E5DCCB   /* bordi */
--verde:     #2E7D5B   /* solo per "camera libera" */
```

Regole visive:
- Font di sistema (`-apple-system, Segoe UI, Inter, Roboto`). Titoli in 700 con `letter-spacing: -0.02em`.
- Angoli generosi: 14px sulle card piccole, 22px sui contenitori grandi, 99px sui bottoni e sui chip.
- Ombre bassissime e calde, mai nere pure.
- Bordi da 1px `--linea` invece di ombre pesanti per separare i blocchi.
- Interfaccia **interamente in italiano**, tono diretto e concreto: "2 camere libere su 4", non "Disponibilità: 2".
- **Mobile first.** La maggior parte degli studenti cerca casa dal telefono, in giro. Progetta prima il layout a 390px, poi allarga.
- Accessibilità: contrasto AA, focus visibile, tutti i form navigabili da tastiera.

## Modello dati

```
profiles           id (uuid, = auth.users), nome, cognome, eta, corso_laurea,
                   anno, sede_principale, genere, bio, foto_url, abitudini text[],
                   budget_max, verificato_unibo bool, created_at

apartments         id, host_id -> profiles, titolo, descrizione, zona, via,
                   lat, lng, piano, camere_totali, camere_occupate,
                   servizi text[], regole text[], contratto_tipo, cauzione,
                   attivo bool, created_at

rooms              id, apartment_id, tipo ('singola'|'doppia'), prezzo_mensile,
                   spese_incluse bool, spese_stimate, disponibile_dal,
                   permanenza_minima_mesi, stato ('libera'|'in_trattativa'|'occupata')

housemates         id, apartment_id, profile_id (nullable), nome_visualizzato,
                   eta, corso, genere
                   /* profile_id nullable: chi pubblica descrive i coinquilini
                      anche se non sono iscritti al sito */

applications       id, room_id, student_id -> profiles, messaggio,
                   stato ('inviata'|'letta'|'accettata'|'rifiutata'), created_at

messages           id, application_id, sender_id, testo, letto_at, created_at

saved_rooms        student_id, room_id, created_at
```

Vincoli importanti:
- `camere_occupate < camere_totali` a livello di CHECK constraint, non solo di validazione client.
- Un annuncio senza almeno una `room` con stato `libera` non compare in ricerca.
- RLS: chiunque legge gli appartamenti attivi; solo l'host modifica i suoi; le `applications` e i `messages` sono visibili solo ai due utenti coinvolti.

## Funzionalità, in ordine di priorità

**1 — Ricerca (la schermata più importante)**
Filtri: prezzo massimo (slider 250–700 €), zona di Bologna, casa per (ragazze / ragazzi / mista / indifferente), tipo stanza, permanenza minima, e checkbox per spese incluse, wi-fi, lavatrice, balcone, arredata, contratto registrato.
Ordinamento: consigliati, prezzo crescente/decrescente, vicinanza alla sede.
I filtri stanno nell'URL come query params, così una ricerca è condivisibile e il tasto indietro funziona.

**2 — Card annuncio**
L'elemento distintivo è l'**indicatore camere**: una fila di quadratini, verdi le libere e grigi le occupate, con la scritta "2 camere libere su 4". Attento al singolare/plurale ("1 camera libera").
Badge automatici: "Ultima camera" quando ne resta una, "Anche breve periodo" sotto i 3 mesi, "Spese incluse", "Contratto registrato".

**3 — Pagina annuncio**
Foto, prezzo con spese esplicitate, indicatore camere, e la sezione **"Chi ci abita già"**: una card per coinquilino con iniziale, nome, età e corso, seguita da card tratteggiate "Camera libera — potresti essere tu".
Sezione **distanze dalle sedi UniBo** calcolate sulle coordinate: Zamboni/Centro, Ingegneria Terracini, Agraria Filippo Re, Economia Belle Arti, Medicina Sant'Orsola. Mostra minuti a piedi e in bici.
Bottone "Contatta la casa" che apre il form di candidatura.

**4 — Pubblica annuncio**
Wizard in 4 passaggi con salvataggio bozza: appartamento → camere e prezzi → chi ci abita → foto e pubblicazione.
Nel passaggio "chi ci abita" l'host inserisce i coinquilini a mano (nome, età, corso). Non obbligarli a essere iscritti.
Geocoding dell'indirizzo con Nominatim, e mostra all'host solo la via, mai il civico, nella scheda pubblica.

**5 — Profilo studente**
Corso, anno, sede principale, budget, bio e chip abitudini (non fumo / fumo / studio a casa / rientro tardi / cucino spesso / ordinato / ho un animale / weekend fuori). L'host vede il profilo quando riceve una candidatura: serve a ridurre i messaggi a vuoto.

**6 — Mappa**
Vista alternativa alla griglia, con pin che mostrano il prezzo e un pannello laterale sincronizzato. Sovrapponi i marker delle sedi UniBo in blu.

**7 — Candidature e messaggi**
Una candidatura porta con sé il profilo dello studente. Chat semplice per conversazione, con Supabase Realtime. Niente notifiche push in questa fase, basta l'email.

## Fiducia — è il vero valore del prodotto

Implementa la **verifica @studio.unibo.it**: chi si registra con una mail istituzionale riceve un badge "Studente UniBo verificato". Consenti anche mail normali, ma senza badge e con un filtro "solo profili verificati" nella ricerca. È la cosa che ci distingue dai gruppi Facebook e va fatta bene fin dall'inizio.

Aggiungi una segnalazione annunci con motivo (richiesta di caparra anticipata, annuncio inesistente, prezzo diverso dal reale).

## Come lavorare

1. Parti dallo schema Supabase e dalle migration SQL, incluse le RLS policy.
2. Poi il design system in Tailwind e i componenti base.
3. Poi ricerca + card + pagina annuncio, con dati seed realistici (12 appartamenti su zone vere di Bologna: Bolognina, Cirenaica, Saragozza, Massarenti, Murri, Navile, San Donato, Santo Stefano, Zamboni, Barca, Fiera, Porta Saffi — prezzi tra 260 e 520 €, che è il mercato reale).
4. Poi auth, pubblicazione annuncio, profilo.
5. Candidature, messaggi e mappa per ultimi.

Dopo ogni blocco fermati, mostrami cosa hai fatto e aspetta conferma prima di andare avanti. Non generare l'app intera in un colpo solo.

Scrivi un `README.md` con le variabili d'ambiente necessarie e i comandi per far partire tutto in locale, e un `CLAUDE.md` con le convenzioni del progetto (palette, lingua dell'interfaccia, struttura cartelle) così le sessioni successive restano coerenti.

Non inventare dati che non ti ho dato: se serve una decisione di prodotto che non ho specificato, chiedimela invece di sceglierla in autonomia.

Inizia dal punto 1.
