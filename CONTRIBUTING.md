# Contributing to OpenEM Wave Lab

Thanks for your interest in contributing. This project holds physics correctness
above visual polish; the rules below exist to keep displayed results trustworthy.

## Ground rules

1. **Read `docs/physics-conventions.md` first.** The phasor convention
   `Re{Ẽ(r)e^{−iωt}}` is global. Formulas transcribed from `e^{+jωt}` textbooks
   (most engineering texts) must be converted; the sign of every imaginary part
   changes. CI includes tests that fail loudly on convention slips.
2. **Every physics change requires a validation test.** New or modified field
   expressions must be covered by at least one of: a closed-form identity, a
   limiting case, or a conservation law (see the validation hierarchy in
   `docs/architecture.md`). A change that only "looks right" in the browser is
   not mergeable.
3. **Physics code never imports rendering code.** `packages/physics-core` has no
   dependency on three.js, React, or the DOM. The renderer consumes
   `sampleField()` and `observables()` generically.
4. **Power flow is computed from E×H.** Never derive Poynting direction from k
   or from the sign of a refractive index.

## Developer Certificate of Origin

Contributions must be signed off (`git commit -s`), certifying the
[Developer Certificate of Origin](https://developercertificate.org/). By signing
off you certify that you wrote the contribution or have the right to submit it
under the project's licenses.

## Licensing of contributions

- Code: Apache-2.0.
- Lesson text, diagrams, and explanatory content: CC BY 4.0.

## Workflow

1. Fork and branch from `main`.
2. `pnpm install && pnpm test` — the suite must pass before and after your change.
3. Run `pnpm typecheck && pnpm lint` locally; CI runs the same checks.
4. Open a pull request describing what changed and, for physics changes, which
   validation evidence covers it.

## Reporting physics errors

Open an issue with: the module, the parameter values (paste the experiment URL),
what the display shows, and what the correct result should be with a reference
(textbook equation, independent calculation, or trusted solver output).
