# Physics conventions

This document is the single source of truth for sign conventions, symbols, and
units in OpenEM Wave Lab. Every model, lesson, and test follows these
conventions. CI includes convention-pin tests that fail if a formula with the
opposite sign convention is introduced.

## Phasor convention

Time-harmonic fields use the physics convention with time factor `e^{−iωt}`:

```
E(r, t) = Re{ Ẽ(r) e^{−iωt} }
```

Consequences (all signs below follow from this choice):

| Quantity                  | This project (`e^{−iωt}`)     | Engineering texts (`e^{+jωt}`) |
| ------------------------- | ----------------------------- | ------------------------------ |
| Outgoing wave along +z    | `Ẽ(z) = E₀ e^{+ikz}`          | `E₀ e^{−jkz}`                  |
| Complex permittivity      | `ε_c = ε + iσ/ω` (Im ε_c ≥ 0) | `ε − jσ/ω`                     |
| Complex wavenumber        | `k = β + iα`, α ≥ 0 (decay)   | `k = β − jα`                   |
| Outgoing cylindrical wave | `H₀⁽¹⁾(kρ)`                   | `H₀⁽²⁾(kρ)`                    |
| Impedance phase (lossy)   | `arg η ∈ (−45°, 0)`           | `arg η ∈ (0°, 45°)`            |

In both conventions H lags E in time for a lossy medium; the sign of `arg η`
flips because the phasors are conjugates.

**When transcribing a formula from a textbook, check its time convention first.**
Most engineering references (Balanis, Pozar, Harrington) use `e^{+jωt}`; most
physics references (Jackson, Griffiths) use `e^{−iωt}`. Converting means
conjugating: replace `j` with `−i` everywhere.

## Derived relations (isotropic, homogeneous media)

- Angular frequency: `ω = 2πf`.
- Complex permittivity: `ε_c = ε₀ε_r + iσ/ω`.
- Wavenumber: `k = ω√(με_c)`, branch chosen so `Re k = β > 0` and `Im k = α ≥ 0`.
- Wavelength: `λ = 2π/β`. Phase velocity: `v_p = ω/β`. Skin depth: `δ = 1/α`.
- Intrinsic impedance: `η = √(μ/ε_c)`, branch with `Re η > 0`.
- For a plane wave along `k̂`: `H̃ = (1/η) k̂ × Ẽ`.

## Planar interfaces

For a plane wave incident from lossless medium 1 (z < 0) onto medium 2 at
z = 0, with the plane of incidence x–z:

- Maxwell curls under this convention: `∇×E = +iωμH`, `∇×H = −iωε_c E`
  (the conjugates of the `e^{+jωt}` forms in Balanis/Pozar).
- `k_x = k₁ sin θ` is conserved (this _is_ Snell's law);
  `k_z2 = √(k₂² − k_x²)` with the branch **Im k_z2 ≥ 0**, so the transmitted
  `e^{i k_z2 z}` decays away from the interface for both TIR and loss.
- Fresnel coefficients in k_z form (valid verbatim for complex `k_z2`):
  `r_TE = (k_z1/μ₁ − k_z2/μ₂)/(k_z1/μ₁ + k_z2/μ₂)`,
  `r_TM = (k_z1/ε₁ − k_z2/ε_c2)/(k_z1/ε₁ + k_z2/ε_c2)`, each with `t = 1 + r`.
- **`r_TM` is the H_y ratio** (the continuous scalar for TM). Textbooks using
  the E-field ratio differ by a sign: `r_TM,E = −r_TM,H`. At normal incidence
  `r_TM,E = r_TE = (η₂ − η₁)/(η₂ + η₁)`; this is pinned in tests.
- Transmittance is computed from `⟨S_z⟩` at the boundary via `½Re{Ẽ×H̃*}` and
  only cross-checked against the closed forms
  `T_TE = Re{k_z2/μ₂}/(k_z1/μ₁)·|t|²`, `T_TM = Re{k_z2/ε_c2}/(k_z1/ε₁)·|t|²`.
- PEC is the exact special case `r_TE = −1`, `r_TM,H = +1`, zero field in
  medium 2 — never a large-σ approximation.

## Power and energy

- Time-averaged Poynting vector: `⟨S⟩ = ½ Re{Ẽ × H̃*}`.
- Instantaneous Poynting vector: `S(t) = E(t) × H(t)`.
- Time-averaged energy densities: `⟨u_E⟩ = ¼ ε |Ẽ|²`, `⟨u_H⟩ = ¼ μ |H̃|²`.
- **Power-flow direction is always computed from the fields.** It is never
  inferred from k̂, from the sign of a refractive index, or from any other
  assumption. In validation, agreement between ⟨S⟩ direction and the expected
  propagation direction is a checked result, not an input.

Displayed quantities are labeled distinctly: instantaneous field, field
magnitude, RMS magnitude, phase, energy density, instantaneous Poynting vector,
and time-averaged Poynting vector are different numbers and are never conflated.

## Polarization

- Handedness follows the **IEEE convention**: right-hand polarization means the
  E-field tip rotation follows the right-hand rule with the thumb along the
  propagation direction (equivalently, clockwise as seen by an observer looking
  along the propagation direction). With `Ẽ = (x̂ + iŷ)E₀/√2` propagating along
  +z under `e^{−iωt}`, the instantaneous field is `∝ x̂ cos ωt + ŷ sin ωt`: the
  tip rotates from +x toward +y, which is **right-hand** circular. `(x̂ − iŷ)`
  gives left-hand. (In `e^{+jωt}` texts the same physical states are written
  with conjugated phasors: there `(x̂ − jŷ)` is RHCP.)
- Polarization state is reported as type (linear / circular / elliptical),
  handedness, axial ratio, and tilt angle of the major axis from +x.

## Units and symbols

SI units throughout: E in V/m, H in A/m, S in W/m², frequency in Hz internally
(displayed with engineering prefixes), lengths in meters, σ in S/m. `ε_r` and
`μ_r` are relative and dimensionless. Constants: `ε₀ = 8.8541878128e−12` F/m,
`μ₀ = 1.25663706212e−6` H/m, `c = 299 792 458` m/s, `η₀ ≈ 376.730` Ω.
