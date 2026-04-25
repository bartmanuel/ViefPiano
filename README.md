# ViefPiano

Mobiele webapp die willekeurig een pianonummer kiest uit je oefenlijst.
Volledig lokaal (localStorage), geen backend, installeerbaar als PWA.

Zie `plan-aanpak.md` voor het ontwerp en de implementatie-historie per fase.

## Ontwikkelen

```bash
npm install
npm run dev      # → http://localhost:5173/ViefPiano/
npm run build    # → dist/
npm run preview  # serveert de build lokaal
```

## Deploy naar GitHub Pages

1. Push naar een repo met naam `ViefPiano` (case-sensitive moet overeenkomen
   met `base` in `vite.config.js`).
2. Repo → Settings → Pages → **Source**: "GitHub Actions".
3. Push naar `main`; de workflow in `.github/workflows/deploy.yml` bouwt en
   publiceert automatisch naar `https://<user>.github.io/ViefPiano/`.

## Stack

- Vite 6 + Svelte 5 (runes)
- vite-plugin-pwa (service worker, autoUpdate)
- localStorage voor data, JSON export/import voor backup
