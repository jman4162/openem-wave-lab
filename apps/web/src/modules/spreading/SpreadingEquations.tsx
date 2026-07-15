import { deriveSpreading, spreadingModel } from '@openem/physics-core';
import { Tex, texNum } from '../../components/Tex';
import { ValidationList } from '../../components/ValidationList';
import { useWaveLabStore } from '../../state/store';

export function SpreadingEquations() {
  const params = useWaveLabStore((s) => s.spreading);
  const derived = deriveSpreading(params);
  const validation = spreadingModel.validate(params);

  return (
    <section style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 13 }}>Governing expressions (scalar)</h3>
      <Tex block>{'\\psi_{\\mathrm{plane}} = A\\,e^{ikx}'}</Tex>
      <Tex block>{'\\psi_{\\mathrm{cyl}} = C\\,H_0^{(1)}(k\\rho)'}</Tex>
      <Tex block>
        {
          '\\psi_{\\mathrm{cyl}} \\to C\\sqrt{\\tfrac{2}{\\pi k\\rho}}\\,e^{i(k\\rho-\\pi/4)}\\quad (k\\rho \\gg 1)'
        }
      </Tex>
      <Tex block>{'\\psi_{\\mathrm{sph}} = B\\,\\frac{e^{ikr}}{r}'}</Tex>
      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>With current parameters</h4>
      <Tex block>
        {`k=${texNum(derived.k)}\\ \\mathrm{rad/m},\\quad \\lambda=${texNum(derived.wavelengthM)}\\ \\mathrm{m}`}
      </Tex>
      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>Why the decay rates differ</h4>
      <p style={{ margin: 0, color: '#555' }}>
        The same power crosses every closed surface around the source. A plane-wave front has
        constant area (amplitude ∝ r⁰); a cylindrical surface grows like ρ (amplitude ∝ 1/√ρ); a
        spherical surface grows like r² (amplitude ∝ 1/r).
      </p>
      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>Common misconceptions</h4>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#555' }}>
        <li>
          A cylindrical wave is not a spherical wave drawn in 2D: it decays as 1/√ρ, not 1/r, and
          its exact field is a Hankel function, not a shifted cosine.
        </li>
        <li>
          The source disk is excluded because the ideal point/line-source expression is singular at
          r = 0; a physical source has finite size.
        </li>
      </ul>
      <ValidationList assumptions={spreadingModel.assumptions} results={validation} />
    </section>
  );
}
