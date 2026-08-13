# SLEPBOLO

Stanze e coinquilini per chi studia a Bologna. A differenza di Idealista o dei gruppi
Facebook, un annuncio mostra **chi abita già in casa**, non solo i metri quadri. Il focus è
trovare il coinquilino giusto per periodi da 3 mesi a un anno accademico.

## Stack

- **Next.js 15** (App Router, TypeScript, Server Components)
- **Tailwind CSS v4** — design system nei token di `src/app/globals.css` (`@theme`)
- **Supabase** — Postgres, Auth, Storage, Row Level Security
- **shadcn/ui** su Radix, restilizzato sulla palette UniBo
- **react-hook-form + zod** per i form
- **MapLibre GL + tile OpenStreetMap** per la mappa (nessuna API key a pagamento)

## Avvio rapido (demo, senza backend)

```bash
npm install
npm run dev
```

Senza variabili d'ambiente Supabase, l'app usa un **dataset dimostrativo in memoria**
(`src/lib/demo-data.ts`, identico al seed SQL): ricerca, card, pagina annuncio, mappa,
profilo e wizard di pubblicazione funzionano subito. Auth e chat richiedono Supabase.

## Collegare Supabase

1. Crea un progetto su [supabase.com](https://supabase.com).
2. Copia `.env.example` in `.env.local` e inserisci URL e anon key.
3. Applica le migration e il seed (Supabase CLI):

   ```bash
   supabase db reset        # esegue migrations/ + seed.sql
   ```

   oppure incolla nel SQL editor, in ordine:
   `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `supabase/seed.sql`.

4. In **Storage** crea un bucket pubblico `foto` per le immagini annuncio.

## Struttura

```
supabase/
  migrations/0001_schema.sql   tabelle, enum, CHECK, trigger, vista ricerca
  migrations/0002_rls.sql      Row Level Security + helper SECURITY DEFINER
  seed.sql                     12 appartamenti su zone reali di Bologna
src/
  app/                 route: / /cerca /annuncio/[id] /pubblica /profilo /accedi /candidature
  components/          header, footer, card, filtri, mappa, form, chat, dialog…
  components/ui/       primitive (button, dialog) su Radix
  lib/                 constants (sedi UniBo, distanze), search, data, supabase, types
```

## Come i requisiti sono coperti

| Area | Dove |
|------|------|
| **Ricerca** con filtri in URL (condivisibile, back funzionante) | `app/cerca`, `lib/search.ts`, `lib/use-url-filtri.ts` |
| **Card** con indicatore camere verde/grigio e badge automatici | `components/annuncio-card.tsx`, `rooms-indicator.tsx`, `badges.tsx` |
| **Pagina annuncio** con "Chi ci abita già" e distanze a piedi/bici | `app/annuncio/[id]`, `lib/constants.ts` (`distanzeSedi`) |
| **Pubblica** wizard 4 passi + bozza + geocoding Nominatim (solo via) | `components/pubblica-wizard.tsx`, `lib/geocoding.ts` |
| **Profilo** studente con chip abitudini | `components/profilo-form.tsx` |
| **Mappa** con pin prezzo, marker sedi UniBo, pannello sincronizzato | `components/mappa-view.tsx` |
| **Candidature + chat** realtime | `app/candidature`, `components/chat.tsx` |
| **Verifica @studio.unibo.it** + filtro "solo verificati" | trigger in `0001_schema.sql`, `components/auth-form.tsx`, filtro sidebar |
| **Segnalazione** annunci con motivo | `components/segnala-annuncio.tsx`, tabella `reports` |

### Vincoli di dominio applicati nel DB (non solo lato client)

- `camere_occupate < camere_totali` → `CHECK` constraint su `apartments`.
- Un annuncio compare in ricerca solo con almeno una `room` `libera` → vista
  `apartments_in_ricerca` e filtro in `lib/data.ts`.
- RLS: appartamenti attivi leggibili da tutti; modifica solo dell'host; `applications` e
  `messages` visibili solo ai due utenti coinvolti.

## App installabile (PWA)

SLEPBOLO è una **Progressive Web App**: una volta online, si installa dal browser e si apre a
schermo intero come un'app nativa, senza App Store né Google Play.

- Manifest: `src/app/manifest.ts` → servito su `/manifest.webmanifest`
- Service worker (cache offline): `public/sw.js`, registrato da `src/components/pwa-install.tsx`
- Icone: `npm run icons` rigenera i PNG in `public/` dal marchio (`scripts/generate-icons.mjs`)
- Prompt d'installazione: pulsante automatico su Android/Chrome; istruzioni *Aggiungi a Home*
  su iPhone/Safari (Apple non espone il prompt automatico)

I service worker richiedono un contesto sicuro: funzionano su `localhost` e in produzione
(HTTPS). In produzione ricordarsi di servire su HTTPS (Vercel lo fa da solo).

## Deploy

Deploy su **Vercel**: importa il repo, imposta le due variabili `NEXT_PUBLIC_SUPABASE_*`,
build automatica, HTTPS incluso. La mappa non richiede chiavi. Una volta online, apri il link
dal telefono e installa l'app dalla home.

## Note

- Le foto reali usano lo Storage di Supabase; in assenza, gli annunci mostrano una
  copertina colorata generata dal design system.
- Prototipo indipendente, non affiliato all'Università di Bologna.
