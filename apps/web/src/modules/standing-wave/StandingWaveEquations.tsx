import { deriveStandingWave, standingWaveModel } from '@openem/physics-core';
import { Tex, texNum } from '../../components/Tex';
import { ValidationList } from '../../components/ValidationList';
import { useWaveLabStore } from '../../state/store';

export function StandingWaveEquations() {
  const params = useWaveLabStore((s) => s.standingWave);
  const derived = deriveStandingWave(params);
  const validation = standingWaveModel.validate(params);

  return (
    <section style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 13 }}>Governing expressions</h3>
      <Tex block>{'\\tilde{E}(z) = E_0\\left(e^{ikz} + \\Gamma\\,e^{-ikz}\\right)'}</Tex>
      <Tex block>
        {'|\\tilde{E}(z)| = E_0\\sqrt{1 + |\\Gamma|^2 + 2|\\Gamma|\\cos(2kz + \\angle\\Gamma)}'}
      </Tex>
      <Tex block>
        {
          '\\mathrm{SWR} = \\frac{1+|\\Gamma|}{1-|\\Gamma|}, \\qquad \\frac{Z_L}{\\eta} = \\frac{1+\\Gamma}{1-\\Gamma}'
        }
      </Tex>
      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>With current parameters</h4>
      <Tex block>
        {`\\lambda = ${texNum(derived.wavelengthM)}\\ \\mathrm{m}, \\quad \\mathrm{SWR} = ${
          Number.isFinite(derived.swr) ? texNum(derived.swr) : '\\infty'
        }`}
      </Tex>
      <Tex block>
        {`\\langle S_z\\rangle / \\langle S_z\\rangle_{fwd} = 1 - |\\Gamma|^2 = ${texNum(derived.netFluxNorm)}`}
      </Tex>
      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>Common misconceptions</h4>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#555' }}>
        <li>
          A node is a minimum of the time-averaged envelope, not wherever the instantaneous field
          happens to cross zero — instantaneous zeros sweep along z between the fixed nodes.
        </li>
        <li>
          For |Γ| &lt; 1 the &quot;nodes&quot; are nonzero: a partial standing wave still carries
          net power (1 − |Γ|²) toward the termination.
        </li>
        <li>
          The blue curve (time-averaged intensity) is drawn on its own baseline because it is a
          different quantity from the field above it, not a third field line.
        </li>
      </ul>
      <ValidationList assumptions={standingWaveModel.assumptions} results={validation} />
    </section>
  );
}
