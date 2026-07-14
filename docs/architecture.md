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

- `packages/rendering` — when a second scene (e.g. spherical wave) reuses glyph
  or scene-graph code.
- `packages/analytic-solutions` / `packages/material-models` — when a second
  model family (interfaces, dispersive media) lands in physics-core.
- `packages/lesson-schema` + `lesson-runtime` — when the first YAML lesson lands.
- `packages/numerical-kernels` — Phase 3 (FDTD laboratory).

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
