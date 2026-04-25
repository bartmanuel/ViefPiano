# ViefPiano — Plan van Aanpak

Webapp om te beslissen welk pianonummer ik moet oefenen uit mijn persoonlijke
lijst. Mobiel, statisch, geen backend, gehost op GitHub Pages.

---

## 1. Tech-stack keuze

**Keuze: Vite + Svelte (vanilla TypeScript optioneel, maar plain JS is prima).**

Onderbouwing:

| Optie | Voor | Tegen |
|---|---|---|
| **Plain HTML/CSS/JS** | Geen build step, direct op GitHub Pages, nul complexiteit. | Met 3 schermen + state (profielen, songs, history) wordt handmatige DOM-sync snel rommelig. Geen componenten → veel herhaling. |
| **Vite + React** | Bekendste framework, veel tutorials. | Bundle is groter (~40KB), JSX + state-management is zwaarder voor een app van deze omvang. |
| **Vite + Svelte** ✅ | Reactiviteit zit in de taal (zonder hooks), bundle is klein (~10–15KB), component-syntax leest bijna als HTML, perfecte match voor kleine apps met lokale state. Vite + GitHub Pages is één commando. | Minder groot ecosysteem dan React, maar voor deze app niet nodig. |
| **Alpine.js / HTMX** | Geen build step. | Minder geschikt voor gedeelde state tussen schermen. |

Svelte is de "pragmatische" keuze: genoeg structuur om niet in DOM-spaghetti te
eindigen, licht genoeg om niet over-engineered te voelen. Plain JS blijft een
redelijke fallback als je echt geen build-step wilt — dan vervangen we Svelte
door een minimal router + losse `.js`-modules in dezelfde structuur.

**Overige keuzes:**
- **Geen CSS-framework.** Handgeschreven CSS met CSS variables is genoeg voor
  drie schermen. (Optioneel: een paar utilities, geen Tailwind.)
- **Geen TypeScript** in fase 1–3 om snelheid te houden. Vite ondersteunt
  later zonder drama migreren.
- **Package manager:** npm (standaard, geen extra installatie nodig).

---

## 2. Repo-/bestandsstructuur

```
ViefPiano/
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions → Pages
├── public/
│   ├── manifest.webmanifest        # PWA manifest
│   ├── icons/
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   └── apple-touch-icon.png
│   └── robots.txt
├── src/
│   ├── main.js                     # Svelte mount
│   ├── App.svelte                  # Root: router + nav
│   ├── routes/
│   │   ├── PlayScreen.svelte       # Hoofdscherm
│   │   ├── ListScreen.svelte       # Lijstbeheer
│   │   ├── ProfileScreen.svelte    # Profielwissel
│   │   └── OnboardScreen.svelte    # Eerste bezoek: profiel aanmaken
│   ├── components/
│   │   ├── SongForm.svelte         # Toevoegen/bewerken
│   │   ├── SongRow.svelte          # Rij in lijst
│   │   ├── TopBar.svelte
│   │   └── ConfirmModal.svelte
│   ├── lib/
│   │   ├── storage.js              # localStorage + schema-versionering + migraties
│   │   ├── picker.js               # Weighted shuffle-bag algoritme
│   │   ├── profiles.js             # CRUD op profielen
│   │   ├── songs.js                # CRUD op songs binnen profiel
│   │   ├── io.js                   # JSON export/import
│   │   └── ids.js                  # kleine ID-generator (crypto.randomUUID fallback)
│   ├── stores/
│   │   └── state.js                # Svelte writable store: {profiles, activeProfileId, ...}
│   ├── config.js                   # Alle tunables op één plek (zie §4)
│   └── styles/
│       └── app.css                 # Mobile-first, CSS vars
├── index.html
├── vite.config.js                  # base: '/ViefPiano/'
├── package.json
├── .gitignore
├── README.md
└── plan-aanpak.md                  # dit bestand
```

Waarom deze split:
- `lib/` = pure functies (testbaar, geen Svelte-dependency).
- `stores/` = reactieve state (één enkele store is genoeg; geen overkill met
  meerdere stores per entiteit).
- `routes/` = schermen (geen echte router nodig — zie §6, fase 1 — één
  `currentScreen`-variabele in de store volstaat).
- `config.js` = één plek voor constanten zoals `PRACTICING_WEIGHT = 2`,
  `ANTI_REPEAT_WINDOW = 1`, `SCHEMA_VERSION = 1`.

---

## 3. Datamodel (localStorage)

Eén enkele sleutel in localStorage: `viefpiano:v1` (de `v1` zit in de key
zodat een major-schema-breaking migratie gewoon naar `viefpiano:v2` kan
schrijven en de oude key als backup kan laten staan).

Daarnaast een `schemaVersion` in de JSON zelf voor minor migraties binnen v1.

```jsonc
{
  "schemaVersion": 1,
  "activeProfileId": "p_6a3f",
  "profiles": {
    "p_6a3f": {
      "id": "p_6a3f",
      "name": "Bart",
      "createdAt": "2026-04-24T18:30:00.000Z",
      "songs": [
        {
          "id": "s_91ac",
          "title": "Prelude in C",
          "composer": "J.S. Bach",    // optioneel
          "notes": "focus op linkerhand", // optioneel
          "practicing": true,             // "nog aan het oefenen"-toggle
          "lastPlayedAt": "2026-04-23T20:11:00.000Z", // null als nooit
          "createdAt": "2026-04-10T09:00:00.000Z"
        }
      ],
      "history": ["s_91ac"],           // laatste N gespeelde song-IDs, anti-repeat
      "bag": ["s_91ac", "s_52bd", "s_91ac", "s_77ee"], // huidige shuffle-bag (zie §4)
      "settings": {
        "practicingWeight": 2          // overschrijft default uit config.js als gezet
      }
    }
  }
}
```

### Schema-versionering aanpak

In `src/lib/storage.js`:

```js
const CURRENT_SCHEMA = 1;

function loadRaw() {
  const raw = localStorage.getItem('viefpiano:v1');
  if (!raw) return null;
  return JSON.parse(raw);
}

function migrate(data) {
  // let op: altijd idempotent en defensief
  if (!data.schemaVersion) data.schemaVersion = 1;
  // voorbeeld voor de toekomst:
  // if (data.schemaVersion < 2) { ...migrate fields... ; data.schemaVersion = 2; }
  return data;
}

function load() {
  const data = loadRaw();
  if (!data) return defaultState();
  return migrate(data);
}
```

Elke toekomstige schemawijziging voegt simpelweg een `if`-tak toe aan
`migrate()`. Zo raak je oude profielen nooit kwijt.

---

## 4. Aanbevelingsalgoritme

### Aanpak: **Gewogen shuffle-bag met anti-repeat**

Waarom shuffle-bag boven pure weighted-random:
- Gegarandeerde eerlijkheid op middellange termijn: elk nummer komt per cyclus
  voor (met extra entries voor "oefenen"-nummers).
- Geen uitschieters waarbij hetzelfde nummer toevallig 3x kort na elkaar komt.
- Simpel te begrijpen en te debuggen.

### Pseudocode

```js
// config.js
export const PRACTICING_WEIGHT = 2;    // oefen-nummers krijgen 2x zoveel entries
export const ANTI_REPEAT_WINDOW = 1;   // laatste N nummers uitsluiten

// picker.js
function buildBag(songs, practicingWeight) {
  const bag = [];
  for (const song of songs) {
    const copies = song.practicing ? practicingWeight : 1;
    for (let i = 0; i < copies; i++) bag.push(song.id);
  }
  return shuffle(bag);   // Fisher-Yates
}

function pickNext(state) {
  let { bag, history, songs } = state;

  if (songs.length === 0) return null;
  if (songs.length === 1) return songs[0].id;  // geen keus

  // (Her)vul de bag als leeg
  if (bag.length === 0) bag = buildBag(songs, config.practicingWeight);

  // Pak kandidaat; als deze in recente history zit, probeer de volgende
  const lastN = history.slice(-ANTI_REPEAT_WINDOW);
  let idx = bag.length - 1;
  while (idx >= 0 && lastN.includes(bag[idx])) idx--;

  // Als alles in de bag in de anti-repeat window zit: pak gewoon de laatste
  if (idx < 0) idx = bag.length - 1;

  const [picked] = bag.splice(idx, 1);
  return { picked, newBag: bag };
}
```

### Wanneer de bag opnieuw bouwen?

- Bij leeg worden.
- Bij elke mutatie aan de songs-lijst (song toegevoegd/verwijderd/status
  gewijzigd): bag wissen en opnieuw opbouwen bij de volgende `pickNext`. Dit
  voorkomt stale entries (verwijderd nummer nog in bag) of scheve gewichten
  (een nieuw oefen-nummer dat pas volgende cyclus meedoet).
- Bij profielwissel: elke profiel heeft zijn eigen bag.

### Effect van "klaar" vs "skip"

| Actie | `lastPlayedAt` bijwerken | `history` bijwerken | Bag-entry consumeren |
|---|---|---|---|
| Klaar / volgende | ✅ | ✅ | ✅ (song uit bag gehaald) |
| Skip | ❌ | ✅ (wel, anders krijg je 'm meteen weer) | ✅ |

Rationale voor skip: de gebruiker zei "skip telt niet als gespeeld" (dus geen
`lastPlayedAt`-update), maar we willen wél voorkomen dat de skip direct
dezelfde song weer voorstelt. Daarom tellen we skips wel mee voor
anti-repeat en consumeren we de bag-entry — anders sta je oneindig dezelfde
song te skippen.

### Concreet voorbeeld: 5 nummers, 2 op "oefenen"

Songs:
- A (oefenen), B (oefenen), C, D, E
- `practicingWeight = 2`

Bag na opbouw (voor shuffle): `[A, A, B, B, C, D, E]` → 7 entries.

Na shuffle (voorbeeld): `[C, B, A, D, B, E, A]`

Pop-volgorde (vanaf eind): A → E → B → D → A → B → C

Anti-repeat kicks in tussen de twee A's: na de eerste A (positie 0 van
volgorde) is de volgende pop E — geen conflict, gaat door. Later krijgen we
A weer aan de beurt, inmiddels zit er genoeg tussen dat history `[D]` is (met
`ANTI_REPEAT_WINDOW = 1`). Prima.

Als het *wel* een conflict zou zijn (bijv. bag-einde zou hetzelfde nummer zijn
als zojuist gespeeld), pakt het algoritme de één-na-laatste entry.

Telling per 7-pop cyclus: A=2, B=2, C=1, D=1, E=1 — precies volgens gewicht.
Over veel cycli heen is dat ~2× zo vaak voor A/B als voor C/D/E.

---

## 5. UI-schets (tekstueel, mobile-first)

### 5.1 Onboarding (eerste bezoek, géén actief profiel)

```
┌────────────────────────────┐
│  🎹 ViefPiano              │
├────────────────────────────┤
│                            │
│  Welkom! Wat is je naam?   │
│                            │
│  ┌──────────────────────┐  │
│  │ Bart                 │  │
│  └──────────────────────┘  │
│                            │
│      [  Beginnen  ]        │
│                            │
└────────────────────────────┘
```

### 5.2 Play Screen (hoofdscherm)

```
┌────────────────────────────┐
│ ▼ Bart         ☰           │  ← topbar: profiel-dropdown, hamburger menu
├────────────────────────────┤
│                            │
│                            │
│                            │
│     Prelude in C           │  ← groot, gecentreerd
│     J.S. Bach              │  ← subtiel, kleiner
│     ───────────            │
│     focus op linkerhand    │  ← notitie, klein/italic (optioneel)
│                            │
│     ★ Aan het oefenen  [●] │  ← toggle voor dit nummer
│                            │
│                            │
│                            │
├────────────────────────────┤
│      [  ⏭  Skip  ]         │  ← secundair, kleiner
│      [  ✓  Klaar — Volgende]│ ← primaire knop, groot
└────────────────────────────┘
```

Topbar-acties:
- Tik op profielnaam → popup met profielen + "beheer profielen"-knop.
- Hamburger → navigeer naar Lijstbeheer.

Lege staat (nog geen songs): toon grote knop "Voeg je eerste nummer toe" die
direct naar de Lijst brengt met het toevoeg-formulier open.

### 5.3 List Screen (lijstbeheer)

```
┌────────────────────────────┐
│ ← Terug      Mijn Lijst    │
├────────────────────────────┤
│ [  +  Nummer toevoegen  ]  │
├────────────────────────────┤
│ ★ Prelude in C          ⋮  │
│   J.S. Bach                │
├────────────────────────────┤
│   Für Elise             ⋮  │
│   Beethoven               │
├────────────────────────────┤
│ ★ Clair de Lune         ⋮  │
│   Debussy                 │
├────────────────────────────┤
│        ... (scroll)        │
├────────────────────────────┤
│  [ ⬇ Exporteer JSON ]      │
│  [ ⬆ Importeer JSON ]      │
└────────────────────────────┘
```

- ★ = oefen-status (geel/gekleurd als aan).
- `⋮` = open rij-acties: bewerken, oefenen-toggle, verwijderen.
- Toevoeg-formulier opent als modal/sheet van onderaf:

```
┌────────────────────────────┐
│  Nieuw nummer        ✕     │
├────────────────────────────┤
│  Titel*                    │
│  [___________________]     │
│  Componist/artiest         │
│  [___________________]     │
│  Notitie                   │
│  [___________________]     │
│  [ ] Nog aan het oefenen   │
│                            │
│       [  Opslaan  ]        │
└────────────────────────────┘
```

### 5.4 Profile Screen

```
┌────────────────────────────┐
│ ← Terug       Profielen    │
├────────────────────────────┤
│  ● Bart (actief)     ⋮     │
│  ○ Eva               ⋮     │
│  ○ Gast              ⋮     │
├────────────────────────────┤
│  [  +  Profiel toevoegen ] │
└────────────────────────────┘
```

- Tik op naam → wissel actief profiel.
- `⋮` op rij → hernoemen / verwijderen (met bevestiging).
- Laatste profiel kan niet verwijderd worden.

---

## 6. Fase-gewijze bouwvolgorde

Elke fase levert een **werkend tussenresultaat** op dat je kunt gebruiken of
demo'en. Niet elke fase hoeft gedeployed te worden, maar het kán per fase.

### Fase 0 — Project setup (½ uur)
- `npm create vite@latest viefpiano -- --template svelte`
- `git init`, push naar GitHub.
- Basic `index.html` met titel, favicon, viewport meta tag:
  `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- `vite.config.js` met `base: '/ViefPiano/'`.
- `.gitignore` voor `node_modules`, `dist`.

✅ **Resultaat**: `npm run dev` toont Vite default pagina op localhost.

### Fase 1 — Basis random pick (1 uur)
- Hardcoded array met 5 songs in `App.svelte` (geen opslag).
- Play Screen UI met titel + "Volgende"-knop.
- Pure `Math.random()` pick, nog geen gewichten, geen skip, geen anti-repeat.

✅ **Resultaat**: je kunt op "Volgende" drukken en krijgt een willekeurig
nummer uit de hardcoded lijst.

### Fase 2 — Lijstbeheer + localStorage (2 uur)
- `storage.js` met load/save/migrate-skelet.
- List Screen: toevoegen, bewerken, verwijderen, oefenen-toggle.
- Navigatie tussen Play en List via één `currentScreen`-variabele in de store.
- Nog één impliciet profiel (geen profielkeuze).
- Play Screen leest nu uit localStorage.

✅ **Resultaat**: werkende oefen-app voor één persoon, data overleeft refresh.

### Fase 3 — Weighted shuffle-bag + skip + anti-repeat (1–2 uur)
- `picker.js` volledig geïmplementeerd volgens §4.
- `lastPlayedAt`, `history`, `bag` velden bijhouden.
- Skip-knop toegevoegd.
- Toggle "aan het oefenen" op Play Screen werkt.
- Bag wordt herbouwd bij lijst-mutaties.

✅ **Resultaat**: eerlijk gewogen selectie; demonstreer door 20× "volgende"
te drukken en te zien dat oefen-nummers ~2× zo vaak verschijnen.

### Fase 4 — Profielen (1 uur)
- Onboard Screen bij leeg state.
- Profile Screen: lijst + toevoegen + wisselen + verwijderen.
- Profiel-dropdown in topbar van Play Screen.
- Datamodel uitgebreid naar `profiles: {}` + `activeProfileId`.
- **Migratie uit fase 3**: wrap de bestaande single-profile state in
  `profiles: { p_default: {...} }`, bewaar als backup.

✅ **Resultaat**: meerdere gebruikers op hetzelfde apparaat.

### Fase 5 — Export/import JSON (½ uur)
- `io.js`: export = download `.json`-bestand van actief profiel.
  Gebruik `Blob` + `URL.createObjectURL` + hidden `<a download>`.
- Import = file input, parse JSON, valideer schema, voeg toe als nieuw
  profiel (met suffix " (import)" als naam al bestaat).

✅ **Resultaat**: backup mogelijk; data meenemen naar andere telefoon.

### Fase 6 — PWA + deploy (1 uur)
- `manifest.webmanifest` met name, short_name, icons, theme_color,
  `display: "standalone"`, `start_url: "/ViefPiano/"`.
- Minimal service worker: cache-first voor de app-shell, network-first voor
  `index.html` (belangrijk: anders update de app nooit — zie §8).
  - Simpelste oplossing: gebruik `vite-plugin-pwa` met Workbox. Spaart je
    veel gedoe.
- GitHub Actions workflow (zie §7).
- Live testen op echte telefoon → installeren naar homescreen.

✅ **Resultaat**: `https://<user>.github.io/ViefPiano/` werkt, installeerbaar,
werkt offline.

### Fase 7 (optioneel, later) — Polish
- Dark mode (via `prefers-color-scheme`).
- Animaties bij "volgende" (song-wissel fade).
- Geschiedenis-view: welke nummers heb je vandaag gespeeld?
- Sorteren/filteren in lijst (op titel, op oefen-status, op `lastPlayedAt`).
- Subtiel haptisch feedback op mobiel (`navigator.vibrate(10)`).

---

## 7. Deploy-instructies voor GitHub Pages

### Aanpak: **GitHub Actions + `actions/deploy-pages`** (aanbevolen)

Dit is de moderne manier; geen `gh-pages` branch nodig.

**Stap 1 — Repo instellingen:**
1. Push je repo naar GitHub als `ViefPiano` (hoofdletters doen er niet toe
   voor URL, maar consistent houden).
2. Settings → Pages → **Source**: "GitHub Actions" (niet "Deploy from a branch").

**Stap 2 — `vite.config.js`:**
```js
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: '/ViefPiano/',   // MOET overeenkomen met repo-naam
});
```

**Stap 3 — `.github/workflows/deploy.yml`:**
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Stap 4 — Commit & push.** Actions-tab toont de build; na een paar minuten
is `https://<je-username>.github.io/ViefPiano/` live.

**Stap 5 — SPA routing-fix** (alleen nodig als je echte URLs gebruikt,
bijv. `/list`; met één-variabele routing niet nodig): kopieer `index.html`
ook naar `404.html` in `dist/`. Voor deze app: skip, we gebruiken geen URLs.

### Alternatief: `gh-pages` branch (ouderwets maar werkt)
- Installeer `gh-pages`: `npm i -D gh-pages`.
- Voeg toe aan `package.json`: `"deploy": "vite build && gh-pages -d dist"`.
- Repo Settings → Pages → Source = branch `gh-pages`, folder `/`.
- Handmatig `npm run deploy` per release.

De Actions-variant is sneller om in te stellen en automatisch bij elke push.

---

## 8. Valkuilen die ik voorzie

### localStorage
- **iOS Safari quota ~5 MB.** Voor deze app geen issue (duizenden songs passen makkelijk), maar wees bewust dat export/import niet eindeloos schaalt.
- **"Website data wissen" op iOS wist localStorage.** Daarom is export-naar-JSON essentieel. Toon de gebruiker bij eerste bezoek of op een onboarding-moment een hint dat backup handmatig is.
- **Private-browsing mode (iOS):** localStorage werkt, maar wordt gewist bij sluiten van het tabblad. Niet ons probleem tenzij de gebruiker altijd privé surft.
- **JSON.parse crash bij corrupte data:** wrap elke load in try/catch; bij corruptie: toon een "data herstellen?"-scherm in plaats van een witte pagina.
- **Race condition bij veel snelle tabs:** twee tabs openen → beide schrijven → één wint. Niet relevant voor mobiele homescreen-gebruik, maar goed om te weten.

### PWA / service worker
- **Stale cache is dé klassieker.** Een te agressieve service worker serveert eeuwig dezelfde `index.html`, en je app update nooit meer. Oplossingen:
  - `vite-plugin-pwa` met `registerType: 'autoUpdate'` en `skipWaiting: true`.
  - `index.html` **never-cache** in de SW (of network-first met korte timeout + fallback).
  - Versie-nummer tonen in de UI (bijv. rechtsonder klein), zodat je kunt controleren of je de laatste build ziet.
- **iOS PWA-quirks:**
  - Service worker op iOS werkt, maar install-prompt niet automatisch — gebruiker moet handmatig "Voeg toe aan beginscherm" via de share-sheet.
  - Voeg `<link rel="apple-touch-icon">` toe, anders pakt iOS een blurry screenshot.
  - `theme-color` en statusbar: test op echte iPhone, niet alleen DevTools.
- **Updates na install:** na een nieuwe deploy werkt de oude PWA door tot de volgende reload. Plan een "nieuwe versie beschikbaar"-banner (vite-plugin-pwa heeft hiervoor `onNeedRefresh`-hook).

### GitHub Pages specifiek
- **Case-sensitivity:** GitHub Pages is case-sensitive op paden. `/ViefPiano/` ≠ `/viefpiano/`. Repo-naam, Vite `base`, en manifest `start_url` moeten identiek zijn.
- **Base-path breekt absolute URLs:** alle asset-links moeten relatief of via Vite's `import.meta.env.BASE_URL` gaan. Vite regelt dit, maar handmatige `<link>` in `index.html` → gebruik `%BASE_URL%` placeholder.
- **Pages-cache CDN:** soms zie je na een deploy nog de oude versie door de CDN-cache. Hard-refresh (Cmd+Shift+R) of incognito om te verifiëren.
- **Custom 404 niet nodig** tenzij je echte URL-routes gaat gebruiken.

### UX-valkuilen
- **Per ongeluk "Volgende" tappen in plaats van "Skip":** de primaire knop is groter en onderaan (duim-bereik); skip is secundair en iets hoger. Misschien een lichte confirmatie bij "Volgende" als het nummer <5 seconden geleden is gestart? Waarschijnlijk over-engineered; laat vallen tenzij het echt gebeurt.
- **Oefen-toggle op Play Screen vs List Screen:** zorg dat beide meteen synchroon blijven (één source of truth: de store).
- **Lege lijst:** Play Screen moet nette lege-staat tonen, niet crashen.
- **Alleen oefen-nummers in lijst:** algoritme werkt gewoon, weight wordt effectief 1:1. Geen edge-case nodig.
- **Eén enkel nummer:** anti-repeat is onmogelijk; laat het nummer toch herhalen (geen keus).

### Algoritme-valkuilen
- **Bag staat in localStorage:** wordt dus gepersisteerd tussen sessies. Bij schema-migraties: wees bereid de bag te droppen (oude song-IDs kunnen inmiddels weg zijn).
- **Song verwijderen terwijl die de "current" is:** na delete opnieuw picken.
- **Eerste pick ooit:** bag is leeg, history is leeg → gewoon bouwen en poppen. Geen speciale case.

---

## 9. Aannames die ik gemaakt heb (check me!)

Laat me weten als iets hiervan niet klopt; dan pas ik het plan aan:

1. **Géén limiet op aantal profielen of songs.** Ik ga uit van <100 songs per
   profiel, <10 profielen — ruim binnen localStorage-grenzen.
2. **Geen speelteller per nummer.** We houden `lastPlayedAt` bij (handig voor
   anti-repeat-context en eventuele sortering later), maar geen totaal-
   telling. Skip werkt hetzelfde als "klaar" voor bag/history-bijwerking;
   alleen `lastPlayedAt` wordt bij skip niet aangeraakt.
3. **`ANTI_REPEAT_WINDOW = 1`** — de spec zei "niet direct na zichzelf
   opnieuw". Wil je eventueel "niet in laatste 2/3 nummers"? Dan verhoog ik
   de constante.
4. **`practicingWeight = 2`** default, aanpasbaar via `config.js`. Geen UI
   om dit in-app aan te passen (spec zei "constante bovenaan"). Kan later.
5. **Profielnamen mogen dubbel voorkomen** (intern ID, geen naam-uniekheid
   vereist). Wil je dat afdwingen? Makkelijk toe te voegen.
6. **Taal: NL** voor alle UI-teksten (omdat jij NL schrijft). Laat weten als
   je EN wilt of bilingual.
7. **Geen analytics, geen cookies, geen trackers.** 100% lokaal.

---

## 10. Time-box inschatting

| Fase | Geschatte tijd (één developer, half-focussed) |
|---|---|
| 0 — setup | 30 min |
| 1 — basis random | 1 u |
| 2 — lijst + storage | 2 u |
| 3 — weighted + skip + anti-repeat | 1,5 u |
| 4 — profielen | 1 u |
| 5 — export/import | 30 min |
| 6 — PWA + deploy | 1 u |
| **Totaal MVP** | **~7,5 uur** |
| 7 — polish (optioneel) | open eind |

Reëel verspreid over een paar avonden. Fase 0–3 is een werkende single-user
app; fase 4–6 zijn de "distributie-klaar"-stappen.

---

## 11. Voortgangslog

Per fase wordt hier gelogd wat gedaan is, zodat het plan ook de
implementatie-geschiedenis bewaart.

### Fase 0 — Project setup
- Status: ✅ klaar
- Aangemaakt: `package.json`, `.gitignore`, `vite.config.js` (base `/ViefPiano/`),
  `svelte.config.js`, `index.html` (viewport meta + theme-color),
  `src/main.js`, `src/App.svelte`, `src/styles/app.css` (mobile-first dark
  theme met CSS vars), `src/config.js` (tunables: `PRACTICING_WEIGHT = 2`,
  `ANTI_REPEAT_WINDOW = 1`, `SCHEMA_VERSION = 1`, `STORAGE_KEY`).
- Stack-versies vastgezet: `vite ^6.3`, `svelte ^5.55`,
  `@sveltejs/vite-plugin-svelte ^6.2.4` (eerdere v4-plugin kon niet met
  vite 6 — peer-dep mismatch).
- `npm install` OK, `npm run build` OK (~29 KB bundle, 11 KB gzipped).
- `git init -b main` uitgevoerd (nog geen commit; doe ik pas als je
  GitHub-repo URL bekend is, of wacht tot fase 6 voor één schone init
  commit).

### Fase 1 — Basis random pick
- Status: ✅ klaar
- Aangemaakt: `src/routes/PlayScreen.svelte` met hardcoded 5-song array
  (Bach, Beethoven, Satie, Debussy, Yiruma), pure `Math.random()` pick,
  één primaire "Klaar — Volgende"-knop onderaan.
- `App.svelte` mount nu `PlayScreen`.
- Mobile-first layout: volledige viewport, song gecentreerd in stage,
  knop onderaan met safe-area padding voor iOS-notch.
- Build: 32 KB (12 KB gzipped).
- Nog **niet** in deze fase: skip, weighted, anti-repeat, lijstbeheer,
  oefen-toggle, profielen — volgt in fase 2+.

### Fase 2 — Lijstbeheer + localStorage
- Status: ✅ klaar
- Aangemaakt:
  - `src/lib/ids.js` — `newId(prefix)` met `crypto.randomUUID`-fallback.
  - `src/lib/storage.js` — `load()` / `save()` / `defaultState()` / `migrate()`
    met defensieve defaults zodat corrupte JSON niet de app crasht.
  - `src/stores/state.svelte.js` — centrale `$state`-rune met
    `addSong` / `updateSong` / `deleteSong` / `togglePracticing` /
    `setScreen` / `invalidateBag`. Elke mutatie `persist()`'t meteen.
  - `src/components/SongForm.svelte` — bottom-sheet modal voor
    toevoegen/bewerken (titel verplicht, componist/notitie/oefenen optioneel).
  - `src/routes/ListScreen.svelte` — lijst met expand-per-rij (oefenen-toggle,
    bewerken, verwijderen met confirm), lege-staat-tekst, topbar met terug-knop.
- `PlayScreen.svelte` leest nu uit `state.songs` in plaats van hardcoded;
  toont lege-staat als lijst leeg is (met knop → lijst). Hamburger-knop
  navigeert naar List.
- `App.svelte` schakelt op `state.screen` tussen `PlayScreen` en `ListScreen`.
- De `bag` wordt nu bij elke songs-mutatie geïnvalideerd (leeg gemaakt). Het
  picker-algoritme zelf is nog pure `Math.random()` — weighted shuffle-bag
  volgt in fase 3.
- Smoke-test: `npm run build` + `npm run dev` op `localhost:5180/ViefPiano/`
  loaden alle modules met HTTP 200; gecompileerde `state.svelte.js` gebruikt
  `$.proxy` + `$.tag_proxy` correct → runes werken.
- Build: 50 KB (19 KB gzipped) inclusief nieuwe schermen.
- Autofocus weggehaald uit `SongForm` (a11y-warning + mobile virtual-keyboard
  UX).

### Fase 3 — Weighted shuffle-bag + skip + anti-repeat
- Status: ✅ klaar
- Aangemaakt: `src/lib/picker.js` met `shuffle()` (Fisher-Yates),
  `buildBag()` (gewogen kopieën van song-IDs) en `pickNext()`.
- `pickNext()` heeft een twee-traps fallback:
  1. Walk bag van eind naar begin; sla entries in de anti-repeat window over.
  2. Als alle entries geblokkeerd zijn → bag rebuilden en opnieuw proberen.
     Voorheen viel-ie direct door naar "pak gewoon het laatste", wat in
     ~1.8% van de picks immediate-repeats opleverde (gevonden via simulatie).
  3. Alleen als ook de nieuwe bag niets bruikbaars heeft (bv. 1 nummer,
     of window > aantal nummers) pakken we toch de laatste entry.
- Simulatie over 7000 picks (5 nummers, 2 oefenen): **0 immediate repeats**,
  verdeling A=1985, B=1985, C=1010, D=1010, E=1010 → 57% oefen-share,
  precies de 4/7 target.
- Edge cases getest: 1 nummer (returns het), 2 nummers (alternert strikt —
  anti-repeat overrulet weight, bekend gevolg met zo weinig nummers),
  lege lijst (returns `null`).
- `app.svelte.js` uitgebreid met `advance(action)` en `ensureCurrent()`:
  - `advance('next')` — push leaving song naar history, update `lastPlayedAt`,
    roep `pickNext`, persist.
  - `advance('skip')` — zelfde maar zonder `lastPlayedAt`-update.
  - History wordt bounded op `max(ANTI_REPEAT_WINDOW * 4, 10)`.
- **Refactor**: state-export heette `state` → botste met `$state`-rune in
  Svelte 5 (compiler dacht aan store-subscription). Hernoemd naar `app`,
  file naar `stores/app.svelte.js`, alle imports aangepast.
- `PlayScreen.svelte`: skip-knop (secundair), grote "Klaar — Volgende"-knop
  (primair), pill-toggle "Aan het oefenen" die realtime de current song
  wisselt.
- `SongForm.svelte`: `svelte-ignore state_referenced_locally` op de
  intentionele initial-value captures (form mount per open, geen reactieve
  sync nodig).
- Build schoon: 51 KB JS / 19 KB gzipped, 0 warnings.

### Fase 4 — Profielen
- Status: ✅ klaar
- **Datamodel verschoven** van single-profile naar multi-profile:
  - Vroeger: `{schemaVersion, songs, history, bag, lastPlayedId}`
  - Nu: `{schemaVersion, activeProfileId, profiles: {id → {id, name,
    createdAt, songs, history, bag, lastPlayedId, settings}}}`
- **Migratie** in `storage.js`: oude top-level `songs`-shape wordt automatisch
  gewrapt in één default-profiel "Ik" met id `p_default`; oude velden
  worden verwijderd. Getest via een node-scriptje met gesimuleerde
  localStorage → migration werkt, alles behouden.
- Elk profiel heeft nu een eigen shuffle-bag/history/lastPlayedId → bij
  profielwissel reset `currentSongId` en picker start vers.
- Aangemaakt / herschreven:
  - `lib/storage.js` — migratie + `defaultProfile()` helper.
  - `stores/app.svelte.js` — `currentProfile()`, `profileList()`,
    `createProfile()`, `switchProfile()`, `renameProfile()`, `deleteProfile()`.
    Laatste profiel kan niet verwijderd worden. Alle song-CRUD en picker-
    integratie draaien nu door `currentProfile()`.
  - `routes/OnboardScreen.svelte` — eerste-bezoek flow: naam vragen,
    `createProfile()`, door naar Play.
  - `routes/ProfileScreen.svelte` — lijst met profielen (actief gemarkeerd),
    tap om te wisselen, inline hernoemen, verwijderen (met confirm, alleen als
    er meer dan 1 is), "profiel toevoegen" inline.
- `App.svelte` is nu een 4-weg router op `app.screen`:
  `onboard` / `play` / `list` / `profiles`. Valt terug op onboard als er
  geen `activeProfileId` is (ook na migratie van lege state).
- `PlayScreen.svelte` topbar toont nu de profielnaam als klikbare knop →
  opent Profile Screen (voldoet aan spec: "profiel-dropdown in topbar").
- `ListScreen.svelte` leest via `currentProfile()`.
- Build: 57 KB JS / 21 KB gzipped, 0 warnings.

### Fase 5 — Export / import JSON
- Status: ✅ klaar
- Aangemaakt: `src/lib/io.js` met `buildExportPayload()`, `downloadProfile()`,
  `parseImport()`.
- Export-formaat: `{app: "viefpiano", schemaVersion: 1, exportedAt, profile:
  {id, name, createdAt, songs, settings}}`. Ephemeral runtime-state
  (`history`/`bag`/`lastPlayedId`) wordt **niet** meegeëxporteerd — een backup
  is geen runtime-snapshot.
- `downloadProfile()` gebruikt `Blob` + hidden `<a download>` + safe filename
  `viefpiano-<naam>-<yyyy-mm-dd>.json`. iOS Safari ondersteunt dit.
- Import: `parseImport()` valideert (geldige JSON, `app`-mark klopt of
  ontbreekt, `profile.songs` is array), normaliseert song-velden en retourneert
  een profiel-klaar object. Caller (`importProfileData` in `app.svelte.js`)
  genereert een nieuw id en voegt " (import)" / " (import 2)" toe aan de naam
  bij collisions.
- `ListScreen`: twee knoppen onderaan (exporteer/importeer), verborgen
  file-input voor import, inline feedback-strip in geel (succes) of rood (fout).
- **Roundtrip-test**: export → parse → check → alle velden behouden (title,
  composer, notes, practicing). **Foutpaden**: malformed JSON, ontbrekende
  `profile`, lege `songs`, verkeerde app-mark → elk geeft een duidelijke
  Nederlandse foutmelding.
- Build: 60 KB JS / 22 KB gzipped, 0 warnings.

### Fase 6 — PWA + GitHub Pages deploy
- Status: ✅ klaar
- `vite-plugin-pwa` ^1.2.0 toegevoegd; `vite.config.js` uitgebreid met
  `VitePWA({ registerType: 'autoUpdate', ... })`.
- Manifest: name + short_name = "ViefPiano", `display: standalone`,
  `start_url` en `scope` = `/ViefPiano/`, theme/background kleuren passen bij
  de dark UI. Icons als SVG (`icon.svg` voor algemene + maskable,
  `apple-touch-icon.svg` voor iOS). SVG icons: elegante alternatief voor
  het moeten genereren van 192/512 PNGs; moderne browsers (iOS 15+) en
  Chrome/Edge ondersteunen dit. **TODO als polish**: echte PNG-iconen als je
  aangepaste grafiek wilt — generator als `pwa-asset-generator` of handmatig
  van ontwerp.
- Service worker strategie: **NetworkFirst voor HTML** (3s timeout → valt
  terug op cache), **precache voor assets** (hashed filenames dus
  cache-breaking werkt automatisch), `cleanupOutdatedCaches()` +
  `skipWaiting()` → updates landen bij volgende refresh zonder "stuck"
  SW. Dit adresseert de valkuil uit §8.
- `index.html` uitgebreid met `<link rel="apple-touch-icon">` en iOS
  meta-tags (`apple-mobile-web-app-capable`, status-bar-style).
- `.github/workflows/deploy.yml` aangemaakt: Node 20 + npm ci + vite build
  + `actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4`. Triggert
  op push naar `main` + handmatig via `workflow_dispatch`.
- `README.md` aangemaakt met dev-commands en 3-staps deploy-instructies.
- **Preview-test** (`npm run preview`) geverifieerd:
  `/ViefPiano/manifest.webmanifest`, `/ViefPiano/sw.js`, `/ViefPiano/icon.svg`
  → alle HTTP 200. SW precacheert 7 entries (~68 KB).
- Build: 60 KB JS + 22 KB gzipped; SW adds ~15 KB (workbox), ook gecached.
- **Opmerking over `npm audit`**: 4 "high" vulnerabilities in transitive
  dev-dependencies (`workbox-build` → `@rollup/plugin-terser` →
  `serialize-javascript`). Deze zitten **alleen in de build-pipeline**, niet
  in de verscheepte bundle. Bij concern: wachten op een workbox-build update
  of alternatief PWA-plugin.

### Fase 7 — Streak, manueel loggen, playCount terug, skip-degradatie
- Status: ✅ klaar
- Trigger: GitHub-issues #1–#4. Vier inhoudelijk gerelateerde features die
  dezelfde files raken, dus in één batch gebouwd.

**Issue #1 — Streak (Duolingo-stijl)**
- Nieuw: `src/lib/streak.js` met `dayString()`, `todayStr()`, `yesterdayStr()`,
  `defaultStreak()`, `extendStreak()`, `displayStreak()`. Dagen als
  `YYYY-MM-DD` in **lokale tijdzone** (bewust, anders breken DST/reizen je
  streak onverwacht).
- Per profiel: `streak: { current, longest, lastPlayedDay, history: [] }`.
- `displayStreak()` toont **0 als de streak verbroken is** (laatst-gespeelde
  dag is niet vandaag of gisteren); `extendStreak()` reset `current` pas bij
  de eerstvolgende play. Zo zie je in de UI direct dat-ie weg is.
- Topbar PlayScreen: `🔥 N` pill (alleen zichtbaar als streak > 0).
- Bovenkant ListScreen: 3-kolom-balk met huidige reeks / langst / dagen
  totaal.
- Streak schuift mee op `advance('next')` én op `markPlayed()`; **niet** op
  `'skip'` (een gepokte song is geen gespeelde song).
- Tests gedraaid: nieuwe streak, idempotent op dezelfde dag, +1 na gisteren,
  reset na gat van >1 dag, display=0 bij verbroken, longest blijft behouden.

**Issue #2 — Handmatig "gespeeld" loggen**
- Nieuw in `app.svelte.js`: `markPlayed(songId)`. Doet hetzelfde als
  `advance('next')` voor één specifiek nummer (lastPlayedAt, playCount++,
  skipStreak=0, history-push, streak-update, één bag-entry consumeren),
  **maar laat `currentSongId` op het Play Screen ongemoeid**.
- ListScreen: per rij een nieuwe primaire actie "✓ Gespeeld" naast de
  bestaande oefen/bewerk/verwijder-knoppen.
- Effect: ook nummers die je los van de shuffle hebt gespeeld tellen mee
  voor de aanbeveling én voor de streak.

**Issue #3 — playCount terug**
- `playCount` veld toegevoegd op song. Bij `addSong()` default 0; bij elke
  `advance('next')` of `markPlayed()` met +1; **niet** bij skip (skip is
  geen play).
- Migratie in `storage.js` zet `playCount = 0` op alle bestaande songs zonder
  veld. Backwards-compat met de eerdere fasen.
- ListScreen toont nu per rij `12×` als subtle counter naast de componist.
- (Eerder uit het plan gehaald op verzoek; nu weer terug op nieuw verzoek.)

**Issue #4 — Skip-degradatie in shuffle**
- `skipStreak` veld toegevoegd op song. +1 bij elke skip; reset naar 0 bij
  elke gespeelde-actie (`next` of `markPlayed`).
- `picker.js` `buildBag()` houdt nu rekening met `skipStreak`:
  - skipStreak=0 → normale gewichten (1 of `PRACTICING_WEIGHT`).
  - skipStreak=N (>0) → kans `1/(1+N)` op **één** entry per bag-build,
    anders **geen** entry. Geen practicing-boost meer voor gedemoteerde
    songs (als je 'm steeds skipt is hij blijkbaar geen prioriteit).
- **Failsafe** in `buildBag()`: als de probabilistische exclusion een lege
  bag oplevert (alle songs gedemoteerd én geen enkele door de loting),
  forceren we 1 entry per song. Zo blokkeert de picker nooit.
- `advance('skip')` invalideert nu de bag (voorheen alleen op andere
  mutaties), zodat de net-gedemoteerde song niet nog 6 picks lang in de
  oude bag blijft hangen.
- ListScreen rij toont `⏭ N`-pill (rood) als skipStreak > 0, met tooltip
  uitleg.
- Tests: song met skipStreak=3 verschijnt in **7.7%** van bag-entries
  (verwacht: 0.25/3.25 = 7.69%). Zonder skips identiek aan vorige fase
  (0 immediate repeats over 7000 picks). Failsafe: 0/1000 lege bags bij
  volledig gedemoteerde set.

**Datamodel update (sec)**
- Profile: + `streak: {current, longest, lastPlayedDay, history[]}`.
- Song: + `playCount: number`, + `skipStreak: number`.
- Migratie heelt oudere shapes.
- Build: 63 KB JS / 23 KB gzipped, 0 warnings.

### Fase 8 — Recap, install-polish, kleine UI-fix
- Status: ✅ klaar
- Trigger: GitHub-issues #5, #6, #7.

**Issue #7 — Skip-knop emoji weg**
- ⏭ uit "Skip"-knop weggehaald, ✓ uit "Klaar — Volgende".

**Issue #5 — Maandoverzicht (Duolingo-recap)**
- Nieuw `playLog: [{songId, ts}]` per profiel. Wordt aangevuld in
  `advance('next')` én `markPlayed()`. Bound op ~13 maanden zodat
  localStorage niet onbeperkt groeit (~65 KB max bij 100 plays/maand).
- Nieuw `src/lib/recap.js` met `monthString()`, `previousMonthStr()`,
  `nextMonthStr()`, `formatMonthLabel()` (Nederlandse maandnamen),
  `getMonthRecap(profile, monthStr)` en `shouldShowRecapBanner(profile)`.
- Recap aggregeert per maand: totalPlays, daysPlayed, longestStreakInMonth
  (afgeleid uit `streak.history`), top-3 songs.
- Nieuw `routes/RecapScreen.svelte` — eigen scherm, prev/next-maand
  navigatie, lege-staat-tekst, 3-stat grid + top-3 lijst.
- Banner op PlayScreen: zodra de vorige maand data heeft en je 'm nog niet
  bekeken hebt, zie je `📅 Bekijk je <maand>-overzicht`. Klikken opent
  recap; sluiten markeert die maand als gezien (`lastDismissedRecapMonth`).
- Knop "Maandoverzicht" onderaan ListScreen voor handmatige toegang
  (altijd, ongeacht banner).
- App.svelte router uitgebreid met `'recap'` screen.
- Tests: 7 plays in mei-data → totalPlays=7, daysPlayed=5,
  longestStreakInMonth=4 (1-2-3-4 met gat na 4), top-3 correct
  gesorteerd. Empty maand → `hasData=false`.

**Issue #6 — Installable PWA**
- Was technisch al klaar in fase 6 (manifest, service worker, scope
  `/ViefPiano/`, display `standalone`). Maar SVG-only icons kunnen op
  oudere Android-versies de install-prompt remmen.
- **PNG iconen toegevoegd**: `icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png` gegenereerd uit de SVG-bron via een nieuw script
  `scripts/gen-icons.mjs` (gebruikt `@resvg/resvg-js` als devDep).
  Manifest icons-array geprefereerd in PNG, met SVG als fallback.
- `index.html` apple-touch-icon link wijst nu naar de PNG (iOS-rendert die
  scherper op het beginscherm).
- `manifest.lang: 'nl'` toegevoegd zodat screen readers en zoekmachines de
  taal correct rapporteren.
- Verifiëren in production: live manifest check + assets allemaal HTTP 200.
- Build precachet nu 10 entries (was 7) door de extra PNGs — totaal nog
  altijd onder 80 KB.

### Wat nu nog handmatig moet
1. **GitHub repo aanmaken** met naam `ViefPiano` (exact deze capitalization),
   push naar `main`, Settings → Pages → Source = "GitHub Actions".
2. **Eerste git commit + push**:
   ```
   git add .
   git commit -m "Initial ViefPiano MVP (fasen 0–6)"
   git remote add origin git@github.com:<USER>/ViefPiano.git
   git push -u origin main
   ```
3. **Op telefoon testen**: na eerste deploy, `https://<user>.github.io/ViefPiano/`
   openen → op iOS via Safari share-sheet → "Voeg toe aan beginscherm".
   Op Android via Chrome → menu → "Installeren".
4. **Echte icons** (optioneel): de SVG-iconen zijn functioneel maar
   spartaans. Voor polish: ontwerp in Figma, exporteer 192/512 PNG, vervang
   `public/icon.svg` door `public/icon-192.png` + `icon-512.png`, update
   `vite.config.js` manifest icons-array.

