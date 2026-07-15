# Architecture

## Layering rule

Physics is independent of visualization. `packages/physics-core` has no
dependency on three.js, React, or the DOM; it exports pure functions and typed
data. The web app consumes models only through the `PhysicsModel` contract:

```ts
interface PhysicsModel<State, Sample> {
  id: string;
  fidelity: 'exact' | 'analytic' | 'reduced-order' | 'numerical' | 'conceptual';
  assumptions: string[];
  parameters: ParameterDefinition[];
  derive(state: State): DerivedQuantities;
  sampleField(state: State, points: Float32Array, time: number): Sample;
  observables(state: State, point?: Vec3, time?: number): Observable[];
  validate(state: State): ValidationResult[];
}
```

The renderer calls `sampleField` and `observables` generically. No wave formula
exists in `apps/web`; the rendering layer never modifies field behavior for
visual effect.

## Module registry

The app hosts multiple experiments through a small registry
(`apps/web/src/modules/registry.ts`). Each `WaveModule` owns a scene factory
(`createScene` returning a `SceneController`) and three panel components
(`Controls`, `Sidebar`, `Equations`); the app shell (nav, canvas, time
controls, URL sync) is module-agnostic. A React-free manifest
(`modules/manifest.ts`) describes each module's URL keys, defaults, and clamp
bounds for the codec, so codec tests never import React components.

Switching modules remounts `SceneView` (keyed by module id), which disposes
and recreates the renderer cleanly. Each module's parameters live in their own
store slice and survive switching.

## Repository layout (decision record)

The product spec describes an end-state monorepo with ~10 packages
(material-models, analytic-solutions, rendering, lesson-runtime, lesson-schema,
equation-renderer, accessibility, validation, numerical-kernels). Phase 0
deliberately creates only two:

- `packages/physics-core` — math, constants, the `PhysicsModel` contract, and
  the plane-wave model with its validation tests.
- `apps/web` — the Vite/React/three.js application.

Rationale: the one boundary that matters architecturally — physics never
imports rendering — is fully enforced by this split. pnpm's strict
`node_modules` makes an accidental cross-package import a hard failure. The
other packages would have no second consumer yet; each would add a
package.json/tsconfig/exports surface with no enforcement benefit.

Extraction triggers (create the package when the trigger fires, not before):

- `packages/rendering` — when a second CONSUMER (worker, second app, published
  package) needs the render primitives. The original trigger ("second scene
  reuses glyph code") fired with the spreading/interface modules, but every
  consumer is still `apps/web`, so a package boundary would enforce nothing.
  Instead, `apps/web/src/render/` is split into store-free primitives
  (`arrowField`, `colormap`, `heatmapLayer`, `createRenderer`) and per-module
  scenes (`render/scenes/*`, which may read the store); the primitives are the
  future package, kept extraction-ready.
- `packages/analytic-solutions` / `packages/material-models` — when splitting
  one pure-TS package into several enforces something. The interface and
  spreading models landed inside physics-core for the same reason as above.
- `packages/lesson-schema` + `lesson-runtime` — when the first YAML lesson lands.
- `packages/numerical-kernels` — Phase 3 (FDTD laboratory).

## Heatmap rendering (60 fps mechanism)

Time-harmonic fields let the expensive work happen once per parameter change:
`HeatmapLayer` caches the complex spatial field (re/im interleaved), and each
frame computes `Re{ψe^{−iωt}} = re·cos ωt + im·sin ωt` per texel through a
256-entry colormap LUT into a `DataTexture` (2 mul + 1 add + lookup; ~1–2 ms
at 256²). Scenes recompute the phasor grid only when their param slice
changes (object-identity dirty check in `frame()`).

No TSL/node materials are used. TSL is the designated escalation path when
grids exceed ~512² (the Phase 3 FDTD laboratory); adopting it earlier would
churn the pinned three.js surface and move physics-adjacent code where
physics-core tests can't see it.

`HeightFieldLayer` is the 3D sibling: the same cached phasor grid displaces
`PlaneGeometry` vertices (`z = re·cos ωt + im·sin ωt` per vertex) with vertex
colors from the same LUTs — unlit `MeshBasicMaterial({vertexColors})`, no
per-frame normals (they cost more than the displacement) and no lighting to
verify across two backends. Height and color redundantly encode the field, so
sign is readable without color. `WaveCurve` is the 1D analog (dynamic Line
plus marker spheres) used by the velocity and standing-wave scenes.

## Responsive shell and quality tiers

Below 900px the App renders a different DOM (canvas-on-top + tabbed panel
mounting only the active tab) selected by a `useMediaQuery` hook; desktop
keeps the three-column grid. Layout/touch/a11y styling lives in
`apps/web/src/app.css` — no UI framework. `SceneView` sets
`setPixelRatio(min(devicePixelRatio, 2))`, and scenes choose grid resolutions
once at construction from `render/quality.ts` (`smallViewport()`); a rotation
mid-session keeps the tier until the next module switch — accepted. `?perf=1`
overlays rolling frame stats for on-device measurement.
`prefers-reduced-motion` loads the app paused unless the link carries an
explicit play state. Deferred accessibility work (screen-reader scene
descriptions, tabular plot alternatives, palette options) is tracked in the
spec §9.2 list; the default diverging colormap is Moreland cool-warm, which is
already colorblind-reasonable.

## TypeScript strategy

Workspace packages export raw `.ts` source (`"exports": { ".": "./src/index.ts" }`).
Vite and Vitest transpile directly; typecheck is per-package `tsc --noEmit` from
the root. No project references and no per-package build step yet — they buy
incremental typecheck and publishability at the cost of `composite`/`outDir`
ceremony, which two packages don't justify. Revisit when typecheck exceeds
~10 s or a package needs publishing.

An ESLint `no-restricted-imports` rule blocks relative paths that escape a
package (`../../packages/...`); cross-package imports go through the package
name.

## State and the render loop (load-bearing pattern)

UI and simulation state live in a zustand store. The three.js animation loop
runs outside React (`WaveScene` owns `requestAnimationFrame`):

- The loop advances `simTime` via `store.setState` and reads parameters via
  `store.getState()` / transient `store.subscribe()` — **no React re-render per
  frame**.
- React components subscribe with selectors and re-render only when the values
  they display change.

Do not "simplify" this into React context or per-frame `useState` — putting
`simTime` in React state re-renders the tree at 60 Hz and destroys frame rate.

## Rendering backend

three.js `WebGPURenderer` (from `three/webgpu`), which falls back to its WebGL2
backend automatically when WebGPU is unavailable. `?gfx=webgl` forces the
fallback for testing. The three.js version is pinned exactly; upgrades are
deliberate PRs with visual checks in both backends. TSL/node materials are not
used in Phase 0.

## Validation hierarchy

Physics modules are tested in this order (spec §8.1): closed-form identities →
limiting cases → conservation laws → boundary-condition residuals → independent
numerical computation → reference data from established solvers. Every model
also exposes the same checks at runtime through `validate()`, so the UI can
display validation status for the current parameters.

## URL state

Scene state serializes to flat query parameters with a schema version
(`?v=1&f=1e9&...`), encoding only non-default keys. The codec lives in one
module (`apps/web/src/state/urlCodec.ts`); if state becomes nested (lesson
steps, multi-scene), switch the codec to base64url JSON without touching
callers.
