import { deriveVelocity, velocityModel } from '@openem/physics-core';
import { Tex, texNum } from '../../components/Tex';
import { ValidationList } from '../../components/ValidationList';
import { useWaveLabStore } from '../../state/store';

export function VelocityEquations() {
  const params = useWaveLabStore((s) => s.velocity);
  const derived = deriveVelocity(params);
  const validation = velocityModel.validate(params);

  return (
    <section style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 13 }}>Governing relations</h3>
      <Tex block>{'\\omega(k) = \\sqrt{\\omega_c^2 + c_m^2 k^2}'}</Tex>
      <Tex block>
        {'v_p = \\frac{\\omega}{k}, \\qquad v_g = \\frac{d\\omega}{dk} = \\frac{c_m^2 k}{\\omega}'}
      </Tex>
      <Tex block>{'v_p\\,v_g = c_m^2 \\quad\\Rightarrow\\quad v_g \\le c_m \\le v_p'}</Tex>
      <Tex block>
        {
          "\\sigma(t) = \\sigma_x\\sqrt{1+\\left(\\tfrac{\\omega'' t}{\\sigma_x^2}\\right)^2},\\qquad \\omega'' = \\frac{c_m^2 - v_g^2}{\\omega}"
        }
      </Tex>
      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>With current parameters</h4>
      <Tex block>
        {`v_p = ${texNum(derived.vP / derived.cM)}\\,c_m, \\quad v_g = ${texNum(derived.vG / derived.cM)}\\,c_m`}
      </Tex>
      <Tex block>
        {`\\lambda = ${texNum(derived.wavelengthM)}\\ \\mathrm{m}, \\quad \\Lambda_{beat} = ${texNum(derived.beatWavelengthM)}\\ \\mathrm{m}`}
      </Tex>
      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>What the markers show</h4>
      <p style={{ margin: 0, color: '#555' }}>
        The amber sphere rides a carrier crest at v_p; the green sphere rides the envelope peak at
        v_g. Above cutoff the amber marker visibly outruns the green one — the crests slide forward
        *through* the envelope.
      </p>
      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>Common misconceptions</h4>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#555' }}>
        <li>
          v_p &gt; c here carries no information — nothing physical travels at the phase velocity of
          an infinite monochromatic wave.
        </li>
        <li>
          v_g equals the energy velocity here only because this medium is lossless with normal
          dispersion. In absorptive or anomalously dispersive media the group velocity is neither
          the energy nor the signal velocity (see the negative-refraction module, coming next).
        </li>
        <li>
          The pulse spreads because v_g itself depends on frequency (ω″ ≠ 0) — a single number
          cannot propagate a finite-bandwidth pulse rigidly.
        </li>
      </ul>
      <ValidationList assumptions={velocityModel.assumptions} results={validation} />
    </section>
  );
}
