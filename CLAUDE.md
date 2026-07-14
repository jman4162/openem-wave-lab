# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

OpenEM Wave Lab: an open-source, browser-based interactive learning platform for
electromagnetic-wave physics. Phase 0 (plane-wave scene) is implemented; the
product spec's later phases add spherical/cylindrical waves, interfaces,
dispersion, negative refraction, and whispering-gallery modes.

## Commands

pnpm 10 workspace (`npm i -g pnpm@10` if missing). Run from the repo root:

```sh
pnpm install
pnpm dev              # Vite dev server for apps/web (localhost:5173)
pnpm test             # all vitest suites (root vitest.config.ts)
pnpm test:watch
pnpm typecheck        # per-package tsc --noEmit
pnpm lint             # ESLint 9 flat config, type-aware
pnpm format           # prettier --write
pnpm build            # all packages

# Single test file:
pnpm vitest run packages/physics-core/test/plane-wave.test.ts

# Per-package:
pnpm --filter @openem/physics-core test
pnpm --filter web build

# Build with the GitHub Pages base path (what deploy.yml does):
VITE_BASE=/openem-wave-lab/ pnpm --filter web build
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, format:check, test, build.
Pushes to main also deploy to https://jman4162.github.io/openem-wave-lab/ via
`deploy.yml` (Pages artifact flow). `?gfx=webgl` on any app URL forces the
WebGL2 backend for testing; the badge in the corner shows the active backend.

## Architecture

Two workspace packages, deliberately lean (decision record and extraction
triggers in `docs/architecture.md`):

- `packages/physics-core` — pure TypeScript physics: complex/vec3 math,
  constants, the `PhysicsModel` contract (`src/model.ts`), and the plane-wave
  model (`src/plane-wave/`). No three.js/React/DOM dependency, ever.
- `apps/web` — Vite + React 19 + three.js app. Rendering consumes models only
  through `sampleField()`/`observables()`; no wave formula lives in the app.

Key structural facts:

- **three.js is pinned exactly** (`three@0.185.0`, no caret). The renderer is
  `WebGPURenderer` from `three/webgpu` with automatic WebGL2 fallback;
  `renderer.init()` is async. Upgrades are deliberate PRs with visual checks in
  both backends. No TSL/node materials in Phase 0.
- **Per-frame state never touches React.** The zustand store
  (`apps/web/src/state/store.ts`) holds simulation time as `tau` (periods, not
  seconds — phase survives frequency changes). `WaveScene.frame()` reads via
  `getState()` and advances tau via `setState`; live UI elements (scrubber,
  ellipse dot) follow via transient subscriptions or rAF loops writing to DOM
  refs. Do not "simplify" this into React state or context.
- **URL state** is flat versioned search params handled entirely in
  `apps/web/src/state/urlCodec.ts` (pure, node-testable) + `urlSync.ts`
  (browser wiring). `tau` is only serialized when paused. New keys must decode
  with defaults so old links keep working.
- Workspace packages export raw `.ts` source (no build step); typecheck is
  per-package `tsc --noEmit`. Cross-package imports go through the package name
  (an ESLint `no-restricted-imports` rule blocks relative escapes).

## Physics rules (non-negotiable)

`docs/physics-conventions.md` is the single source of truth. Summary:

- Phasor convention `Re{Ẽ(r)e^{−iωt}}` everywhere ⇒ `ε_c = ε + iσ/ω`
  (**plus** sign), `k = β + iα` with α ≥ 0, outgoing wave `e^{+ikz}`,
  `arg η < 0` for lossy media. Formulas from `e^{+jωt}` textbooks (Balanis,
  Pozar) must be conjugated. Convention-pin tests in
  `packages/physics-core/test/plane-wave.test.ts` fail loudly on slips —
  if one trips, the code is wrong, not the test.
- Power flow is computed from `½Re{Ẽ×H̃*}` / `E×H`, never inferred from k or
  the sign of a refractive index.
- Instantaneous field, magnitude, phase, energy density, and instantaneous vs
  time-averaged Poynting vector are distinct displayed quantities.
- Every physics change requires a validation test (closed-form identity,
  limiting case, or conservation law — hierarchy in `docs/architecture.md`).
  Models also expose the same checks at runtime via `validate()`.
- IEEE handedness for polarization; under this convention `(x̂ + iŷ)` is RHCP
  for +z propagation.

## Repository conventions

- `*.local.md` files are untracked working notes (first line of `.gitignore`).
- Commits are DCO signed (`git commit -s`).
- Code is Apache-2.0; lesson/explanatory content is CC BY 4.0.
