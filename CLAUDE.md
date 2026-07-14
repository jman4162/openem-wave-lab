# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This is a greenfield project. No code exists yet. The only file is
`background-info.local.md`, a draft product/technical spec for **OpenEM Wave Lab** —
an open-source, browser-based interactive learning platform for electromagnetic-wave
physics (plane/spherical/cylindrical waves, polarization, Fresnel interfaces,
phase/group/energy velocity, negative refraction, whispering-gallery modes, standing
waves). Read that spec before making design decisions; this file summarizes its
binding choices. Update this file with real build/test commands once scaffolding exists.

## Planned stack and layout

- TypeScript + React + Vite, static deployment (no backend), PWA support.
- Rendering: Three.js `WebGPURenderer` with WebGL2 fallback. WebGPU-first, never WebGPU-only.
- Computation paths, in order of preference: (1) TypeScript analytic models for
  instant parameter updates, (2) Web Workers for root finding / eigenmode solving,
  (3) WebGPU compute shaders for dense grids. Pyodide is optional tooling only —
  never in the interaction loop. Meep runs offline to generate reference/validation
  data; it must not become a browser dependency (GPL isolation).
- Monorepo layout per spec §7.2: `apps/web/`, `packages/` (physics-core,
  material-models, analytic-solutions, numerical-kernels, rendering, lesson-runtime,
  lesson-schema, equation-renderer, accessibility, validation), `content/lessons/`,
  `reference/`, `tools/`, `docs/`.
- Licensing: Apache-2.0 for code, CC BY 4.0 for lesson content.

## Architecture rules

- **Physics is independent of visualization.** Every experiment implements the
  `PhysicsModel` contract (spec §7.3): declared `fidelity` level ("exact" |
  "analytic" | "reduced-order" | "numerical" | "conceptual"), explicit `assumptions`,
  `sampleField`, `observables`, `validate`. The renderer consumes samples and
  observables generically — no lesson-specific formulas in rendering code, and the
  rendering layer never modifies field behavior for visual effect.
- **Lessons are data, not code.** Version-controlled YAML/JSON conforming to the
  lesson schema (spec §7.4). Adding a lesson must not require touching the engine.
- Every scene state must serialize to a shareable URL and JSON experiment file.
- Analytic models before solvers: do not build an FDTD canvas first. The 2D FDTD
  "numerical laboratory" is Phase 3 and stays separate from analytic lessons.

## Physics-correctness rules (non-negotiable per spec)

- Phasor convention is `Re{Ẽ(r) e^{-iωt}}`, stated in every lesson and globally
  consistent. Never silently mix `e^{-iωt}` and `e^{+jωt}` conventions.
- Power-flow direction is computed from E×H, never assumed from k or inferred from
  the sign of refractive index. Negative refraction must use a causal dispersive
  model (Drude/Lorentz with loss), not an unrestricted "n = −1" material.
- Cylindrical waves use the Hankel function `H₀⁽¹⁾(kρ)`, not cosine/√ρ; the 1/√ρ
  form appears only as a labeled far-field asymptote.
- Point-source expressions are never evaluated at r = 0 — use an excluded source
  region or finite source.
- Field, magnitude, phase, energy density, and instantaneous vs. time-averaged
  Poynting vector are distinct displayed quantities; don't conflate them.
- Every physics module ships with validation tests following the spec §8.1 hierarchy:
  closed-form identities → limiting cases → conservation laws (e.g. R + T = 1,
  Brewster zero, TIR unit reflectance) → boundary-condition residuals → independent
  numerics → reference-solver data.

## MVP order

Phase 0 prototype: one reusable plane-wave scene with E/H/k vectors, time scrubbing,
polarization ellipse, movable probe, live equation panel, URL serialization, and
WebGPU/WebGL2 detection. Phase 1 adds spherical/cylindrical spreading, a single
planar interface, velocity comparisons, standing waves, and constrained
negative-refraction and whispering-gallery lessons.

## Conventions

- `*.local.md` files are local working notes and should stay out of version control
  once the repo is initialized.
