# SLEPBOLO — Cosa resta da fare (guida passo-passo)

Io ho preparato tutto il codice. Restano **3 cose**, tutte con account gratuiti a tuo nome.
Ordine consigliato: A → B → C. Tempo totale: ~20 minuti.

⚠️ **Sicurezza:** durante questi passaggi incontrerai una password del database e una chiave
"service_role". **Non mandarmele mai.** A me serve passare solo due valori pubblici (li trovi
al punto A5): il *Project URL* e la chiave *anon public*.

---

## A) Database Supabase — accende registrazione, login, chat (~10 min)

1. Vai su **https://supabase.com** → *Start your project* → accedi (Google va bene).
2. **New project**:
   - Name: `slepbolo`
   - Database Password: scegline una e **conservala tu** (non serve a me)
   - Region: **Central EU (Frankfurt)**
   - *Create new project* → aspetta ~2 minuti.
3. Menù a sinistra **SQL Editor** → *New query*.
4. Apri il file **`supabase/setup.sql`** di questo progetto, copia **tutto**, incollalo
   nell'editor e premi **Run**. Deve dire *Success*. (Crea tabelle, sicurezza, chat realtime,
   spazio foto.)
5. *(Opzionale, consigliato)* Nuova query → incolla e Run **`supabase/seed.sql`**: aggiunge i
   12 annunci di esempio su zone vere di Bologna.
6. Menù **Project Settings** (ingranaggio) → **API**. Copia questi due:
   - **Project URL** (tipo `https://xxxx.supabase.co`)
   - **Project API keys → `anon` `public`** (una stringa lunga)
7. *(Per accedere subito senza email di conferma)* Menù **Authentication → Providers → Email**:
   metti **Confirm email = OFF**, Save. (In produzione poi lo riattivi.)

➡️ **Incollami qui i due valori del punto A6.** Da lì l'app gira coi dati veri.
(Oppure, se preferisci fare da solo: aprili nel file `.env.local`, riga `NEXT_PUBLIC_...=`,
salva, e riavvia con `npm run dev`.)

---

## B) Mettere l'app online su Vercel — la rende installabile sul telefono (~7 min)

Serve prima un repository. Io ho già inizializzato git e fatto il primo commit.

1. Crea un account su **https://github.com** (se non ce l'hai).
2. Crea un repo vuoto chiamato `slepbolo` (senza README).
3. Nella cartella del progetto, collega e carica (sostituisci `TUO-UTENTE`):
   ```bash
   git remote add origin https://github.com/TUO-UTENTE/slepbolo.git
   git push -u origin main
   ```
4. Vai su **https://vercel.com** → accedi con GitHub → *Add New → Project* → importa `slepbolo`.
5. Prima di *Deploy*, apri **Environment Variables** e aggiungi le due del punto A6:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. **Deploy**. Dopo ~1 minuto avrai un link tipo `https://slepbolo.vercel.app`.

---

## C) Installare l'app sul telefono (~1 min)

Apri il link Vercel dal telefono:

- **Android (Chrome):** compare "Installa app" in basso → tocca. Oppure menù ⋮ → *Installa app*.
- **iPhone (Safari):** tocca **Condividi** → **Aggiungi alla schermata Home**.

Ora hai l'icona SLEPBOLO sulla home: si apre a schermo intero, come un'app vera.

---

## Riepilogo di chi fa cosa

| | Fatto da me | Resta a te |
|---|---|---|
| Codice app (web + PWA) | ✅ | — |
| SQL database + sicurezza + chat + foto | ✅ scritto e pronto | incollarlo su Supabase (A4) |
| Icone, manifest, service worker | ✅ | — |
| git + primo commit | ✅ | push su GitHub (B3) |
| Account Supabase / GitHub / Vercel | — | crearli (gratis) |
| Variabili d'ambiente | template pronto | incollare le 2 chiavi |

Appena mi passi i due valori del punto A6, verifico che tutto giri coi dati reali.
