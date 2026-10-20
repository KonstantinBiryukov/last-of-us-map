# Implementation Guide

This guide explains how the app actually works, file by file, and how to change it.
Every source file also starts with a plain-language comment describing its job.

---

## 1. Architecture in one picture

```
                         ┌──────────────────────────────┐
  data/ (pure data) ───► │  PlaybackEngine  (one clock)  │ ◄── buttons, timeline, markers,
  route GeoJSON  ──────► │  time → chapter/slide/leg/    │     keyboard (commands)
                         │          distance             │
                         └──────────────┬───────────────┘
                                        │ read-only
          ┌─────────────────────────────┼─────────────────────────────┐
          ▼                             ▼                             ▼
  FrameLoop (the ONE rAF loop)   React UI (re-renders only      Mapbox map
  each frame:                    when chapter/slide/status      └─ custom layer: Three.js
   • engine.advance(dt)          change)                            (travellers + effects)
   • route reveal, camera,        • StoryPanel + Slideshow      Route lines + markers
     scrubber, progress bars      • PlayerBar (journey + music)  drawn by Mapbox
   • map.triggerRepaint()         • MapControls, Intro, About
```

Key ideas:

1. **One source of truth.** The whole story is a single number, `time` (seconds),
   owned by `PlaybackEngine`. A pure function (`locate`) turns any time into
   *chapter, slide, leg, leg progress and distance along the route*. The slideshow,
   map camera, route reveal and 3D travellers all read that — none keeps its own
   copy, so they cannot drift apart. Seeking is deterministic.
2. **One animation loop.** `FrameLoop` is the only `requestAnimationFrame` loop.
   It advances the engine by real elapsed time (`dt`), so speed does not depend on
   frame rate, then runs the per-frame tasks.
3. **Two speeds of state.** Per-frame values (time, distance) are read directly by
   Three.js, Mapbox and a few DOM nodes (scrubber, progress bars) — never through
   React. React only re-renders when something slow changes (a new slide every 5 s,
   play/pause). This keeps React out of the 60 fps path.
4. **One WebGL context.** Three.js renders inside Mapbox's own WebGL context via a
   Mapbox custom layer, so 3D objects are correctly hidden by terrain, share the
   camera exactly, and there is no second canvas.
5. **Music is independent.** The soundtrack has its own controls; pausing or jumping
   in the journey never touches it.

## 2. Source directories and important files

```
index.html                 Page shell (title, favicon via %BASE_URL%)
vite.config.ts             Build config — base: '/last-of-us-map/'
.env.example               Template for the Mapbox token (copy to .env.local)
scripts/
  optimize-images.mjs      Generates WebP copies + blur placeholders + manifest
  deploy-gh-pages.mjs      Builds and publishes dist/ to the gh-pages branch
.github/workflows/deploy.yml  Optional manual "Deploy" button on GitHub
public/
  .nojekyll                Tells GitHub Pages to serve files as-is
  server/info/test2.geojson  ORIGINAL route geometry (17 legs, ~21 500 points)
  server/info/markers.geojson ORIGINAL locations (kept for reference; data now in src/data)
  server/assets/…          ORIGINAL images and music (unchanged)
  server/optimized/…       Generated WebP versions of the images
src/
  main.tsx, App.tsx        Entry point; routes; intro/about overlays
  config/env.ts            Reads VITE_MAPBOX_TOKEN
  config/assets.ts         assetUrl() adds the /last-of-us-map/ base; optimizedImage()
  data/types.ts            The data model (Location, Leg, Chapter, Slide, Track…)
  data/locations.ts        8 locations (migrated from markers.geojson)
  data/chapters.ts         12 chapters: slides (original order), location, legs
  data/legs.ts             Metadata for the 17 route legs (kind, travel mode)
  data/soundtrack.ts       6 tracks in the original playlist order
  data/generated/imageManifest.json   Written by optimize-images.mjs
  geo/polyline.ts          Distances, point-at-distance, bearing (pure math)
  geo/mercator.ts          Lng/lat ↔ Mapbox's flat mercator coordinates
  geo/route.ts             Loads test2.geojson → measured legs + one journey line
  playback/timeline.ts     Lays chapters/slides/legs on the clock; locate(time)
  playback/machine.ts      The play/pause/seek state machine (pure reducer)
  playback/engine.ts       PlaybackEngine: commands + snapshot store for React
  playback/frameLoop.ts    The single requestAnimationFrame loop
  audio/MusicPlayer.ts     Soundtrack player built on <audio>
  map/MapView.tsx          Creates the Mapbox map; wires layers, markers, camera
  map/mapStyle.ts          Style URLs, season light presets, 3D terrain
  map/routeLayers.ts       Route line layers + progressive reveal controller
  map/markers.ts           Location markers (buttons) + hover preview
  map/camera.ts            CameraDirector: follow / overview / free modes
  map/FallbackMap.tsx      SVG map used when Mapbox cannot run
  three/JourneyLayer.ts    Mapbox custom layer that renders the Three.js scene
  three/models/*.ts        Joel & Ellie, horse, truck (procedural low-poly) + poses
  three/effects.ts         Trail ribbon, dust, season particles, beacon, shadow
  three/materials.ts       Shared colours/materials/geometries (created once)
  journey/                 React context + runtime creation (engine, loop, music)
  state/                   Tiny external-store helper; display settings (fixed, no menu)
  ui/                      React components (+ *.module.css next to each)
  styles/global.css        Design tokens, marker/popup styles, reduced motion
```

## 3. Install dependencies (macOS)

```bash
brew install node        # needs Node ≥ 22.12; Node 24 LTS or 26 recommended (.nvmrc says 26)
cd last-of-us-map
npm install
```

The old Vue project could not be installed any more (its `node-sass@4` dependency
does not compile on modern Node). The rewrite has no native build steps except
`sharp`, which ships prebuilt binaries and is only used by the image script.

## 4. Run locally

```bash
npm run dev
```

Open **http://localhost:5173/last-of-us-map/#/** (the dev server uses the same
`/last-of-us-map/` path as production, so URL problems show up early).

To test the real production build:

```bash
npm run build
npm run preview          # http://localhost:4173/last-of-us-map/#/
```

## 5. Configure the Mapbox access token

1. Create a free account at https://account.mapbox.com and copy a **public** token (`pk.…`).
2. `cp .env.example .env.local` and set `VITE_MAPBOX_TOKEN=pk.…`.
3. Restart `npm run dev`.

`.env.local` is in `.gitignore` — it is never committed. The token is read in
`src/config/env.ts`.

**About public tokens:** a `pk.` token is *not* a secret like a password: every
visitor's browser needs it to download map tiles, so it ends up inside the published
JavaScript. Protect it in the Mapbox dashboard instead:

- **URL restrictions:** `https://konstantinbiryukov.github.io/last-of-us-map/*`,
  plus `http://localhost:5173/*` and `http://localhost:4173/*` for development.
- Keep only the default public scopes. Never put a secret (`sk.…`) token in this app.

**Without a token** (or if the token is rejected, or WebGL is unavailable) the app
shows `FallbackMap`: an SVG map of the same route and locations, still fully
synchronised with the slideshow, timeline and music. Mapbox GL JS may only be used
with a valid token, so the fallback does not use Mapbox at all.

## 6. How the journey playback engine works

**The clock** (`playback/timeline.ts`). Each chapter lasts *slides × 5 s* (the
original slideshow's pace; total ≈ 11 minutes). Travel fills the **whole** chapter —
there is no waiting before or holding after — so wherever you click on the timeline,
Joel and Ellie are on their way:

```
slides  |title|year | img | img | img | img | img | img |
travel  |time skip |======== walking through Boston =======|
        ^chapter start                         chapter end^
```

Jumps and time skips (no detailed path) take a fixed 4.5 s; the remaining time is
shared by the chapter's detailed **leg parts** in proportion to their length. A long
leg can be split between two chapters (`{ leg: 6, from: 0, to: 0.71 }`), with the
fraction chosen so the pace stays the same across the boundary (worked numbers are
next to each split in `data/chapters.ts`; a unit test checks it).
`locate(timeline, time)` returns a `JourneyFrame`: chapter, slide, slide progress,
leg, progress along the whole leg and along the current part, and **distance along
the journey** — the single number that positions the travellers, the route reveal
and the camera.

**The state machine** (`playback/machine.ts`):

```
 idle ──play──► playing ◄──pause/play──► paused
                  │  time reaches end        ▲
                  ▼                          │ seek back
               finished ──play/replay──► playing (from 0)
```

`reduce(state, event)` is pure: `play`, `pause`, `toggle`, `tick(dt)`, `seek(t)`,
`replay`. Ticks only move time while `playing`; one tick is capped at 0.25 s so a
frozen tab or debugger pause never makes the story leap.

**The engine** (`playback/engine.ts`) wraps the reducer and offers commands:
`play`, `pause`, `toggle`, `seek`, `seekInChapter`, `goToChapter`, `goToLocation`,
`next`, `previous` (restarts the chapter if > 3 s in), `restartChapter`, `replay`,
`goToSlide`, `nextSlide`, `previousSlide`. Seeking keeps the play/pause state.
Discontinuous jumps emit an `onJump` event (the camera flies there). React reads
`getSnapshot()` (status, chapter, slide, leg) through `useSyncExternalStore`;
the snapshot object only changes when one of those values changes.

**The loop** (`playback/frameLoop.ts`) calls `engine.advance(dt)` then every task:
route reveal + camera + repaint (MapView), scrubber (StoryTimeline), slide progress
bar (Slideshow), music position (MusicControls). On `visibilitychange` the clock
re-anchors so hidden time is not counted.

**Tests:** `machine.test.ts`, `timeline.test.ts`, `engine.test.ts`,
`frameLoop.test.ts` cover pause/resume, pausing just before a chapter boundary,
seeking, replay, distant jumps, frame-rate independence and loop cleanup.

## 7. Locations, route geometry and travel modes

- **Locations** (`data/locations.ts`): id, title, short name, coordinates, marker
  icon, photo, description paragraphs. Copied 1:1 from `markers.geojson`; a test
  (`data.test.ts`) checks coordinates, icons and photos against the original file.
- **Route geometry** stays in the original `public/server/info/test2.geojson` and is
  fetched at runtime (3 MB, kept out of the JS bundle). The file is **not perfect**, so
  `geo/route.ts` corrects it in memory (`correctLegs`, unit-tested) without changing
  the file:
  1. *Gaps closed* — consecutive legs did not always touch (≈1.2 km gap entering
     Pittsburgh, ≈1.1 km near Jackson). Each detailed leg now starts exactly where the
     previous one ended.
  2. *Jumps become arcs* — five features had only 2 points (the real path is unknown).
     They are replaced by smooth 64-point arcs from the previous leg's end to the next
     leg's start, drawn dashed with arrow heads.
  3. *Boston streets* — the original Boston section of the Boston → Lincoln leg meandered
     within ~1 km of downtown (the travellers seemed to walk on the spot). It is replaced by
     a 3.8 km walking route through the game's places, following real streets:
     QZ (North End) → Robert at the docks → the Fireflies (Government Center) → beyond the
     wall → Downtown (Downtown Crossing) → The Museum (Old State House) → The Capitol
     (State House), then the original line from the State House to Lincoln. It was generated
     once with the Mapbox Directions API — `npm run build:streets -- boston` (script
     `scripts/build-street-routes.mjs`, output `public/server/info/boston-streets.geojson`,
     which also records each stop's distance along the line). The game's places are
     fictionalised; each stop is a real place chosen to match the story.
  4. *St. Mark's Hospital* — the original route stopped in downtown Salt Lake City, ~10 km
     short of the game's last stop. Leg 13 now continues with a 12.8 km walking route to
     St. Mark's Hospital (the real basis of the game's St. Mary's; `build:streets -- hospital`
     → `hospital-streets.geojson`), and the Epilogue drive (leg 14) starts there with a
     5.5 km driving route that joins the original line on I-80 (`build:streets -- escape`
     → `escape-streets.geojson`). The Salt Lake City marker moved to the hospital too.
  Each correction is a `streets: { route, at: 'start' | 'end' }` entry in `data/legs.ts`.
  Only regenerate a route you need: chapter split points are measured on the committed files.
  Long straight interstate stretches (points 2–6 km apart on the 500–700 km legs in
  Wyoming/Colorado) are valid road geometry and are kept; a test flags any hop > 10 km.
  The legs are then glued into one `journey` polyline (`legStart`/`legEnd` give each
  leg's position on it).
- **Legs** (`data/legs.ts`) describe each GeoJSON feature:
  - `kind`: `detailed` (real polyline) · `jump` (no detailed path — a dashed arc with
    arrow heads; the camera pulls out to show the whole leap and a glowing comet flies
    along it while the travellers fade out) · `timeskip` (Austin → Boston, 20 years —
    the same, but dotted and labelled "Time passes").
  - `mode`: `walk` · `horse` · `vehicle`, with `modeSource`: `canon` (shown in the
    game: the truck in the prologue, Bill's truck, horseback from Jackson and in
    winter, the drive from Salt Lake City) or `default` (not established → walking,
    and the UI says "travel mode assumed").
- **Chapters** (`data/chapters.ts`) link it together: location, season, slides, the
  leg parts travelled during the chapter (every chapter has at least one), and the
  `ambience` particle moods for that place.
- **Leg parts** can override who travels and how:
  `{ leg, from, to, party, mode, wounded, timeShare, note }`. `party` is a list of characters
  in walking order (default `['joel', 'ellie']`; companions: Tess, Bill, Henry, Sam,
  David); `wounded` lays Joel across the horse behind Ellie.
  Used exactly where the game has them:
  - *Quarantine Zone* — Joel and Tess cross the QZ to Robert and the Fireflies; Ellie joins
    when Marlene hands her over; the three slip beyond the wall.
  - *The Outskirts* — the game's sections Downtown → The Museum → The Capitol Building, the
    three of them (~70 % of the chapter); Tess stays behind at the Capitol; Joel and Ellie
    then walk out of Boston to just outside Lincoln (compressed into the last 30 %).
  - *Bill's Town* — starts right outside Lincoln; into the town, through it with Bill; the
    last 20 % is Bill's truck driving out of Lincoln (the drive continues in *Pittsburgh*).
  - *Pittsburgh* / *The Suburbs* — Henry and Sam join near the end of *Pittsburgh* and
    walk with them through *The Suburbs*.
  - *Tommy's Dam* — Tommy and his wife Maria do not walk with them: they stand at the dam (part
    of the dam's key-point prop, the same blocky characters, held in a standing pose).
  - *Lakeside Resort* — 50 % Ellie riding with wounded Joel lying across the horse (the
    escape after the university), 20 % Ellie on foot (alone, then with David), 20 % Joel
    alone on foot searching for her, and the last 10 % together again.
  - *Epilogue* — by car most of the way; only the last 20 % on foot, home to Jackson.
  The 3D layer shows only the party (each companion has their own look, in the same
  low-poly style); the story panel shows "Joel & Tess", "Joel, Henry, Sam & Ellie",
  "Ellie & David", "Ellie, with Joel wounded", etc.
- **Which chapter travels where** follows each chapter's images: Boston chapters stay in
  Boston; *Bill's Town* stays between Boston's edge and Lincoln; Bill's truck drive opens
  *Pittsburgh* (as in the game); *Bus Depot* starts with the jump to Utah and stays near Salt
  Lake City. Tests in `data.test.ts` check every chapter against real coordinates.
- **Pacing inside a chapter** weighs each part by length ÷ mode speed (walk 1, horse 2.5,
  truck 5), so a short walk is not rushed through at truck speed. A part can instead take a
  fixed share of its chapter with `timeShare` (e.g. `0.2` = 20 %), used where distance alone
  would mislead (a long walk compressed into the end of a chapter, the Epilogue's last walk).
- **Camera zoom** is chosen per part so the travellers always visibly move (about 28 px/s
  on screen), up to street level (zoom 15.5) for the slow city walks in Boston and Lincoln.

## 8. Add or modify a story location

1. Add the id to the `LocationId` union in `data/types.ts`.
2. Add an entry to `LOCATIONS` in `data/locations.ts` (coordinates are `[lng, lat]`).
3. Put the marker icon and photo under `public/server/assets/…` and run
   `npm run optimize:images`.
4. Point a chapter at it (`locationId`) in `data/chapters.ts`.
5. If the travellers should go there, add a LineString to `test2.geojson`, describe it
   in `data/legs.ts` (same index as the feature), and add `{ leg: <index> }` to the
   chapter's `legs` — legs must stay in route order and every slice must continue where
   the previous one stopped (tests check both). A 2-point feature marked `kind: 'jump'`
   is drawn automatically as an arc with arrows.
6. `npm test` — the data tests verify every referenced file exists.

## 9. Associate slideshow images with locations

Slides belong to chapters, and chapters belong to locations:

1. Copy images into `public/server/assets/story_telling_images/chapters/<n>/`.
2. Add the file names, in order, to that chapter's `slides(n, [...])` list.
   Title cards are detected by name (`chapterN`, `N_year`, logos) and shown uncropped.
3. Run `npm run optimize:images` (WebP copy + blur placeholder; without it the
   original file is used — slower, but it works).
Each slide adds 5 s to its chapter; the route timing adapts automatically. If the
chapter shares a leg with its neighbour, re-check the split fraction (see the comment
above that chapter's `legs`); `npm test` warns if the pace jumps by more than 25 %.

## 10. Replace or add 3D models and animations

The travellers are procedural low-poly models (no downloaded assets; no suitable
free licensed Joel/Ellie models exist, and this keeps the download tiny):

- `three/models/character.ts` — Joel/Ellie built from boxes and capsules on joints
  (`JOEL` and `ELLIE` looks: proportions, colours, beard/ponytail). Poses:
  `poseWalk`, `poseIdle`, `poseSeated`.
- `three/models/horse.ts` — four-beat walk gait (`poseHorse`).
- `three/models/truck.ts` — wheels spin with distance; suspension bob (`poseTruck`).
- `three/JourneyLayer.ts` — builds the three "rigs" (walking pair, horse + riders,
  truck + riders), shows the one matching the current leg's `mode`, orients it along
  the route (`bearingAt`) and scales it to a constant on-screen size.

All animation phases are computed from **story time** (`frame.time`), so they freeze
exactly when paused, are identical after seeking and stay continuous across leg and
chapter boundaries.

**On-screen size.** The models are scaled to a constant height in screen pixels
(walkers 81 px, horse 60 px, truck 40 px). The pixel size is *measured* every frame by
projecting the travellers' position and a point 100 m east of it through the real
camera, so tilted views and flights no longer make the truck look huge.

**Seasonal particles** (`three/ambience.ts`). Each chapter lists 1–2 moods in
`ambience` — embers and smoke (Austin's burning night), dust and cordyceps spores
(Boston), fireflies (Pittsburgh summer, the Firefly lab), falling leaves (fall),
snow (Lakeside), pollen and petals (spring). They are animated entirely on the GPU:
each particle gets four random numbers once, and the vertex shader computes its
position from time, drift and sway, wrapping inside a "weather box" that follows the
travellers but is anchored to the world. The CPU only updates a few uniforms per
frame. To add a mood: add a name to `AmbienceKind` (`data/types.ts`), a recipe in
`RECIPES` (count, colours, velocity, shape, size…), and list it in a chapter.

**Chapter key points** (`data/keyPoints.ts` → `playback/keyPoints.ts` → `three/keyPoints.ts`,
models in `three/models/props.ts`). Each chapter lists the game's sections ("The Museum",
"The Cargo", "The Giraffes", …) with a blockmesh prop kind and a real-world `coord` (the place
the game's location is based on, or a fitting real stand-in — `basis` says which). Placement
is computed once (`placeKeyPoints`, unit-tested) by these rules, most important first:
nobody walks through a prop (its footprint keeps clear of every travelled part of the route,
also where it doubles back, with room for the walking party even at the widest follow zoom);
props never overlap; each stands at the point of its chapter's walked route closest to its
real place (in game order), on the side where that place lies; and its size follows the
travellers' size there (the follow camera's zoom, `playback/followZoom.ts`) × 0.7 — shared by
neighbouring props seen at similar zooms (a group takes its smallest size), so nearby buildings
stay in proportion (props are drawn at 1.15× the walkers' scale; Boston ×0.7 and Hometown ×0.5 via `scale`). *Close* places (`close:
true`: Joel's house where the drive starts, the Massachusetts State House at the end of the
Boston walk, the Fireflies' hospital) stand right beside the route — the travellers brush past
them — preferably on their real site (the State House: within 60 m of its real dome, between
the streets the trio walks). *Exact* landmarks (`exact: { heading }`: Pittsburgh's yellow
Roberto Clemente Bridge) stand exactly at their coordinate along their real axis; nothing may
stand in front of them as the north-looking camera sees them, and while the travellers cross
the bridge they are drawn walking straight along its deck (`crossing`, JourneyLayer). The drawn
path is also lightly smoothed (±10 screen pixels) so fast mountain stretches with switchbacks
(Lakeside's ride) don't make the travellers snap from side to side. When an ideal spot
breaks a rule, placement tries the other side, standing a little further out, small nudges along
the route, and only then a smaller size for the whole group. Nothing changes at runtime: fixed
size and spot, all props on the map from the first frame (far off-screen ones skipped while
drawing), each standing on the highest of five terrain samples under its footprint with a deep
plinth hidden in slopes. The story panel lists the chapter's key points and lights up the ones
passed. To add a point: add it to `KEY_POINTS` (`coord`, `basis`, optional `close`/`exact`); to add a
prop shape: add a `PropKind`, its `PROP_RADIUS` and a builder in `three/models/props.ts`.

**Per-part camera** (`camera` on a leg part in `data/chapters.ts`): `zoom` brings the follow
camera closer (+) or further (−) than usual for that part; `heading: 'route'` turns the map so
the travellers move up the screen (used for Lakeside Resort's southbound ride, where they would
otherwise ride straight down into their own trail). Key-point props follow the adjusted zoom.

**Camera** (`map/camera.ts`). *Follow* glides after the travellers at a zoom matched
to their speed and swoops out over jumps; *Overview* frames the whole journey;
*Free* never moves on its own ("Explore the map"). During the journey the map **cannot be
panned** (dragging it away let the travellers walk off-screen while the story played): wheel,
pinch and the +/− buttons zoom around the centre and following continues at that zoom (kept
as an offset from the camera's own choice: at most 1 level out, 3.5 levels in). Explore allows panning
again, fenced to North America (`setMaxBounds`): it cannot be dragged or zoomed out past it.
Any story navigation — next/previous chapter, clicking a location, releasing the
timeline — switches back to Follow and flies there. Users can pan and zoom but **not rotate
or tilt** (right-click/Ctrl-drag, two-finger twist and tilt, Shift+arrows are disabled):
tilt and heading are the director's choices. Every flight carries an id so an
interrupted flight cannot hand control back early (the cause of an earlier bug where
the camera stopped following after quick chapter clicks).

Story flights last 2–5 s (growing with the logarithm of the distance) with a gentle "ease in-out sine"
curve, so chapter clicks travel quickly without a jolt.

**Trail under the travellers.** The glowing trail behind them ignores depth (so hills never cut
it); it is drawn in the solid pass before the characters and props (`renderOrder −1`,
non-transparent material, still additively blended), so they always stand on top of it.

**Markers** are Mapbox HTML markers: Mapbox writes the marker element's `transform` on every
camera move, so hover effects scale the inner icon/ring instead — a CSS transition on the
element itself made the markers lag and shake while the camera moved.

**Main menu.** The house button (top-left) returns to the title screen and pauses the
story; the title screen then offers *Continue the journey*, *Start over* and *Explore the map*.

**Explore the map** (`#/map`) is a separate experience on the same map
(`ui/viewMode.ts`, `ui/ExplorePanel.tsx`): the route, jump arrows and 3D travellers are
hidden (`setJourneyLayersVisible` in `map/routeLayers.ts` — hidden layers are not even
rendered), every marker looks the same (`MarkerLayer.setMode('explore')`), the camera
frames all locations once and then stays free (`CameraDirector.setExploring`), and the
story is paused. A side panel lists the eight places; clicking a place (in the list or on
the map) opens its card with photo, description and the chapters set there — each chapter
button starts the journey from that chapter. Only a small music bar remains.

**To use a glTF model instead:** load it once in `JourneyLayer.onAdd` with
`GLTFLoader` (`three/examples/jsm/loaders/GLTFLoader.js`), add it to the relevant
rig group, scale it to metres, rotate it to face −Z (north), and drive its
`AnimationMixer` with `mixer.setTime(frame.time)` (not `update(dt)`) to keep
it deterministic. Keep models small (< 2 MB, < 20k triangles) and dispose them in
`onRemove`.

**New travel mode:** add it to `TravelMode` in `data/types.ts`, then the TypeScript
compiler will point to every `Record<TravelMode, …>` table you must extend
(screen size, trail style, dust rate, shadow size, UI label/icon).

## 11. Soundtrack and music player

- Tracks and their order live in `data/soundtrack.ts` (original order from the old
  player: Seasons → The Last of Us → The Path → All Gone → The Path (Vacant) →
  The Path (A New Beginning), then loop).
- `audio/MusicPlayer.ts` uses the browser's `<audio>` element (Howler was removed):
  play/pause keep the position, `restart()` is explicit, seek, volume and mute
  (remembered in localStorage), automatic next track, loading/error states.
- **Autoplay:** browsers block sound until the user clicks. "Begin the journey" is a
  click, so music starts there. If blocked (e.g. opening `#/path` directly), the play
  button pulses and the player says "Press play to start the music".
- To add a track: drop the MP3 into `public/server/assets/music/` and add an entry.

## 12. Type checks, tests, production build

```bash
npm run typecheck   # tsc strict: app (tsconfig.json), tests (tsconfig.test.json), config
npm test            # Vitest
npm run build       # typecheck + vite build → dist/
npm run check       # all three
```

## 13. Deploy to GitHub Pages

The site is a GitHub Pages **project site**: the `gh-pages` branch is served at
`https://konstantinbiryukov.github.io/last-of-us-map/`. The build uses
`base: '/last-of-us-map/'` and hash routes (`#/…`), so deep links work without a server.

**From your Mac (same flow as the old script):**

```bash
npm run deploy
```

This checks for the token, builds, verifies `dist/index.html` uses
`/last-of-us-map/assets/…` and that `.nojekyll` exists, then publishes `dist/` to
`gh-pages`. Your working branch and files are not touched.

**From GitHub (optional):** add a repository secret `MAPBOX_TOKEN`, then
Actions → "Deploy to GitHub Pages" → Run workflow. It runs `npm run check` and
publishes to the same `gh-pages` branch. It never runs automatically.

In the repository settings, Pages must stay on *Deploy from a branch → gh-pages → /(root)*
(as it is today).

## 14. Verify the published URL after deploying

1. Wait 1–2 minutes, then open https://konstantinbiryukov.github.io/last-of-us-map/#/
   in a private window (avoids cached files).
2. The title screen appears; DevTools → Network shows `assets/*.js` and
   `server/assets/*` loading from `/last-of-us-map/…` with status 200.
3. Click **Begin the journey**: the satellite map, the truck in Austin and the music start.
4. Open https://konstantinbiryukov.github.io/last-of-us-map/#/map and `#/about`
   directly — both must load (old links keep working).
5. If the map shows the "simplified map" notice, check the token and its URL
   restrictions (see §5).

## 15. Troubleshooting

| Problem | Fix |
| --- | --- |
| "No Mapbox token is configured" | Create `.env.local` (§5) and restart `npm run dev` / rebuild. |
| "The Mapbox token was rejected" | The token's URL restrictions don't include the current address. Add it in the Mapbox dashboard. |
| Blank page on GitHub Pages, 404s for `/assets/…` | Something removed `base: '/last-of-us-map/'` from `vite.config.ts`. |
| Files starting with `_` 404 on Pages | `.nojekyll` missing in `dist/` (it comes from `public/.nojekyll`). |
| No music | Browser autoplay policy — press the music play button once. |
| Slow or hot laptop | Machines with 4 or fewer CPU threads get no 3D terrain or particles automatically (`state/settings.ts`); there is no settings menu. |
| Camera does not move | You are in *overview* (Overview button) or *Explore the map*. Press *Follow* (F) or pick a chapter. |
| Want to see the frame rate | Open the page with `?stats` before the `#` (see Appendix A). |
| `npm install` warns about engines | Use Node 24 LTS or newer (`brew upgrade node`). |
| Images load slowly after adding new ones | Run `npm run optimize:images`. |
| Map white after the GPU reset/sleep | The app rebuilds the map automatically after a WebGL context loss; reload if it persists. |

---

## Appendix A — Performance notes (measured)

Measured in Chrome on this Mac (Apple Silicon), dev build, horseback chapter:

| Work per frame | Cost |
| --- | --- |
| Three.js layer (`JourneyLayer.render`) | ~0.11 ms CPU, 66 draw calls, ~2 100 triangles + 848 GPU-animated particles (winter chapter) |
| All FrameLoop tasks (route reveal, camera, UI bars) | ~0.006 ms |
| Story lookup (`locate` + position + bearing) | ~0.12 µs |
| Route preprocessing at startup (21 532 points) | ~1.5 ms once |

Measures in place: one rAF loop; React outside the frame path; shared
materials/geometries; fixed-size reusable GPU buffers for effects (no per-frame
allocation); scratch vectors/matrices reused; continuous repaints only while playing
or while particles are on; season particles fade out when zoomed out; terrain and
particles off by default on ≤ 4-core machines; images 35.4 MB → 7.2 MB (WebP, sized,
blur placeholders, next two slides preloaded); Mapbox and Three.js in separate cached
chunks; source maps not published. Mapbox v3 controls the canvas pixel ratio itself
(no option to cap it).

**Rust/WebAssembly was not added:** the only CPU-heavy step, route preprocessing,
takes ~1.5 ms in TypeScript, and per-frame work is microseconds — WebAssembly would
add a second toolchain for no measurable gain.

**Measured frame rate:** 120 fps (8.3 ms average, worst frame 8.7–9.4 ms) on a 120 Hz
Apple Silicon display, in Lakeside Resort with 3D terrain, snow crystals and the horse /
walker models — i.e. every frame met the display's refresh. (Measured in a 900×600 window;
a full-screen window has more pixels to fill, so check on your own machine.)

**Check it yourself:** add `?stats` to the address before the `#`, e.g.
`http://localhost:5173/last-of-us-map/?stats#/path` — a small meter shows fps, average and
worst frame time. Chrome DevTools → Performance also works for deeper profiling.

## Appendix C — How well the route matches the game

The game never shows a map, so "correct" means *consistent with the places the game and the
chapter images show*. Checked against real coordinates (automated in `data.test.ts`):

| Check | Result |
| --- | --- |
| Markers: Austin, Boston (North End = the game's QZ), Lincoln, Pittsburgh, Jackson, Fort Collins (CSU = University of Eastern Colorado) | within 0–5 km of the real places ✔ |
| Silver Lake marker | ~11 km east of Silver Lake in the Boulder watershed — fine at map scale |
| Salt Lake City marker | was ~26 km **west** of downtown (near Magna); **moved** to St. Mark's Hospital (the basis of the game's St. Mary's), where the route now ends (§7, correction 4) |
| *Bill's Town* showed Connecticut/Pennsylvania | **fixed** — it starts right outside Lincoln (< 3 km), and only its last 20 % drives out of Lincoln in Bill's truck; the drive west continues in *Pittsburgh* |
| Boston chapters walked on the spot | **fixed** — a street route through the game's places (§7, correction 3); the split points (Ellie joins at the Fireflies, Tess stays at the Capitol) are tested to land within 150 m of those places |
| *Bus Depot* walked through Colorado | **fixed** — the Colorado mountain walk belongs to *Lakeside Resort*; *Bus Depot* starts with the jump to Utah and stays within 80 km of Salt Lake City (the original jump lands near Provo); *The Firefly Lab* is the last ~17 km into the city plus ~13 km of streets to the hospital |
| Boston chapters | stay in Boston (QZ within 3 km, Outskirts within 8 km of the State House) ✔ |
| Leg order and travel modes (truck, horse) | match the game's chapters ✔ |
| Prologue drive | ends ~47 km south-west of Austin — longer than the game's drive to the outskirts (harmless) |
| Entry into Salt Lake City | from the south (via Provo); the wiki text says they appear to enter from the west — the game doesn't confirm either |
| Gaps / straight shortcuts | ~1 km gaps closed; 2-point stretches drawn as clearly-marked jumps (§7) ✔ |

## Appendix B — Data migration from the Vue version

| Old | New |
| --- | --- |
| `markers.geojson` (8 features) | `src/data/locations.ts` — same values; Austin's broken `\n` split into paragraphs. The descriptions match The Last of Us Wiki (Fandom) 2019–2020 revisions, so they are credited as CC BY-SA 3.0 in About and README |
| `PathCardsFlux.vue` image list (134) | `src/data/chapters.ts` — grouped by their existing `chapters/N` folders, order unchanged |
| `PathVizualization.vue` timers (17 legs) | `src/data/legs.ts` + timeline; gaps closed; hidden 2-point features → jump arcs / time skip |
| `ThePlayer.vue` (Howler, 6 songs) | `src/data/soundtrack.ts` + `MusicPlayer.ts`, same order and looping |
| `path_cards.json` | Not migrated — it held placeholder text ("Austin2", "Joel and Ellie2") and was unused by the UI |
| Hard-coded Mapbox tokens in `store/index.js` | Removed; token now from `.env.local` |
| `vue-flux` per-slide transitions (arbitrary slide/fade list) | One consistent cinematic cross-fade + slow drift |
