# The Last of Us — Cinematic Interactive Journey Map

**Live site:** https://konstantinbiryukov.github.io/last-of-us-map/#/

Follow Joel and Ellie across America, chapter by chapter. The map, the 3D
travellers, the route, the story images and the soundtrack all move together
on one timeline — press play and watch. Or choose **Explore the map**: a free map
of the USA with only the locations, where you click a place to read about it.

- **Mapbox GL JS** draws the satellite/atlas map, the route lines and the location markers.
- **Three.js**, running *inside* the Mapbox map, draws Joel and Ellie walking, riding a
  horse or driving a truck, a glowing trail, dust, seasonal particles and a destination ripple.
- **React + TypeScript (strict)** build the interface: story panel with a synchronised
  slideshow, a single cinematic player bar (journey + soundtrack), map controls.

> ⚠️ Spoilers for the entire game. Images © Naughty Dog; music by Gustavo Santaolalla.
> Non-commercial fan project.

## Quick start (macOS)

```bash
brew install node            # Node 24 LTS or newer (26 is used during development)
git clone https://github.com/KonstantinBiryukov/last-of-us-map.git
cd last-of-us-map
npm install
cp .env.example .env.local   # then paste your Mapbox public token (pk.…) into .env.local
npm run dev                  # open http://localhost:5173/last-of-us-map/#/
```

Without a token the app still works, using a simplified built-in map (no 3D).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run typecheck` | TypeScript strict type check (app, tests, config) |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Type check + production build into `dist/` |
| `npm run preview` | Serve `dist/` at http://localhost:4173/last-of-us-map/ |
| `npm run check` | Type check + tests + build (what CI runs) |
| `npm run deploy` | Build and publish `dist/` to the `gh-pages` branch |
| `npm run optimize:images` | Regenerate WebP images + blur placeholders |

## Keyboard

`Space` play/pause · `←/→` image · `Shift+←/→` chapter · `M` music · `F` follow · `O` overview

## Documentation

Everything else — architecture, data model, adding locations or slides,
replacing 3D models, soundtrack, deployment and troubleshooting — is in
**[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)**.
