# AGENTS.md

## Run / verify
- No root build, lint, typecheck, or package manager workflow is configured. Root game is plain ES2022 modules + Canvas 2D served as static files.
- Run locally from repo root (ES modules do **not** work via `file://`):
  - `python3 -m http.server 8080` → open `http://localhost:8080/`
- Some prototype subprojects have their own Node tests (not wired from root). Example: `cd pruebas/clima-espacial && node simulator.test.mjs` (also `npm test` there; uses `"type": "module"`). Run subproject commands from that subproject directory.

## Architecture (root integrated app)
- `index.html`: main shell/UI. Loads game (`./src/main.js`) and overlays/minigames; also dynamically imports `./pruebas/clima-espacial/app.js` and `./pruebas/MonitorVisor/visor.js`. Many UI/activity integrations are coordinated via `window` globals (e.g. `__moonGame`, `openEnergyMinigame`, `openElectrolisisActivity`, `openControlPanel`, `showGameNotice`) and `postMessage`/custom events.
- `src/main.js`: bootstrap; creates `Game`, sets initial scene to `InteriorBaseScene` (base principal) with exit callback to `DemoScene`, stores game on `window.__moonGame`.
- `src/config.js`: shared constants (logical 320x180, fixed timestep 60 Hz, layers/masks, player/camera/physics tuning). Prefer changing values here over magic numbers.
- `src/core/`: loop/input/time/game orchestration. `src/graphics/`, `src/physics/`, `src/entities/`, `src/scenes/`, `src/systems/`, `src/ui/`, `src/events/`, `src/minigames/`: engine/game modules.
- `assets/manifest.json`: image asset manifest loaded at startup (`src/graphics/AssetLoader` usage). When adding/referencing sprites, keep keys/paths consistent with manifest and on-disk files.
- `EnergySystem.js`, `oxygen_system.js` at root and many files under `pruebas/`, `final/`, `archive/`, `docs/`, `Documentacion/` are prototypes, experiments, docs, or snapshots—do not assume they are part of the root runtime unless `index.html`/`src` imports them.

## Conventions / gotchas
- Follow README architecture notes: fixed-timestep physics + interpolated render, top-down 3/4 y-sort by feet/base, AABB foot/collider-based collision and sliding, camera/world in logical pixels.
- Donki/space-weather: `index.html` main game does not mount the live test panel; experimental/live-fetch code lives in `src/events/` and `pruebas/MonitorVisor` / `pruebas/clima-espacial`. `src/events/donkiLive.js` queries public DONKI endpoints and emits `lunar:donki-alert` on `document`.
- Repo contains Spanish naming/content in docs, UI, and some paths; preserve existing style and avoid breaking path-sensitive asset/iframe URLs (some paths include spaces/encoded segments).
- Prefer editing the canonical integrated sources (`index.html`, `src/**`, `assets/**`) for game behavior. `final/final/` and nested copies under `pruebas/pruebas/` mirror other states—edit them only if the task explicitly targets them.
- No automated CI workflows found in-repo; manually verify by serving from root and exercising affected flows in-browser.
