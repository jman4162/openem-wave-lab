# OpenEM Wave Lab

A transparent, interactive laboratory for seeing how electromagnetic waves actually
behave — and how the equations, phase, fields, materials, and energy flow fit together.

OpenEM Wave Lab is an open-source, browser-based learning platform for
electromagnetic-wave physics. It sits between static textbook figures and
professional computational electromagnetics software: every lesson is an analytic
or reduced-order model whose parameters you can change and whose equations,
field vectors, phase fronts, and power flow update together in real time.

## Status

Early development. Current work: Phase 0 prototype — a plane-wave scene with
E/H/k vector visualization, time scrubbing, a movable field probe, a polarization
ellipse, a live equation panel, and shareable experiment URLs.

Planned modules (see the roadmap in `docs/`): plane waves and polarization,
spherical and cylindrical spreading, reflection and transmission at interfaces,
phase/group/energy velocity, standing waves, negative refraction with causal
dispersive materials, and whispering-gallery modes.

## Principles

- **Physics first.** The physics model is independent of the visualization; the
  renderer never modifies field behavior for visual effect. Every module declares
  its fidelity level (exact, analytic, reduced-order, numerical, or conceptual)
  and its assumptions.
- **Power flow is computed, not assumed.** Poynting vectors come from E×H, never
  from the direction of k or the sign of a refractive index.
- **One phasor convention.** Fields are `Re{Ẽ(r)e^{−iωt}}` everywhere, stated in
  every lesson and enforced by tests. See `docs/physics-conventions.md`.
- **Validated.** Every physics module ships with tests against closed-form
  identities, limiting cases, and conservation laws.

## Development

Requires Node ≥ 24 and pnpm 10 (`npm i -g pnpm@10`).

```sh
pnpm install
pnpm dev        # serve the web app locally
pnpm test       # run all tests
pnpm typecheck
pnpm lint
pnpm build
```

## License

Code is licensed under [Apache-2.0](LICENSE). Written lessons, diagrams, and
explanatory content are licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Physics changes require validation
tests; lessons must identify their equations, assumptions, and validation
evidence.
