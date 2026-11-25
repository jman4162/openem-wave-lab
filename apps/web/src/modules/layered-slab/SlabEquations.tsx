import { cabs, carg, deriveLayeredSlab, layeredSlabModel } from '@openem/physics-core';
import { Tex, texNum } from '../../components/Tex';
import { ValidationList } from '../../components/ValidationList';
import { useWaveLabStore } from '../../state/store';

export function SlabEquations() {
  const params = useWaveLabStore((s) => s.layeredSlab);
  const derived = deriveLayeredSlab(params);
  const validation = layeredSlabModel.validate(params);
  const isTE = params.polarization === 'TE';
  const psi = isTE ? '\\tilde{E}_y' : '\\tilde{H}_y';
  const rDeg = ((carg(derived.r) * 180) / Math.PI).toFixed(1);
  const regionEquations = [
    `${psi}(z<0)\\propto e^{ik_xx}\\left(e^{ik_{z1}z}+r\\,e^{-ik_{z1}z}\\right)`,
    `${psi}(0\\le z\\le d)\\propto e^{ik_xx}\\left(A\\,e^{ik_{z2}z}+B\\,e^{-ik_{z2}z}\\right)`,
    `${psi}(z>d)\\propto t\\,e^{ik_xx}e^{ik_{z3}(z-d)}`,
  ];

  return (
    <section style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 13 }}>
        Governing equations ({params.polarization})
      </h3>
      {regionEquations.map((eq) => (
        <Tex key={eq} block>
          {eq}
        </Tex>
      ))}
      <Tex block>
        {
          'r=\\frac{r_{12}+r_{23}e^{2i\\delta}}{1+r_{12}r_{23}e^{2i\\delta}},\\qquad \\delta=k_{z2}d'
        }
      </Tex>
      <Tex block>{'t=\\frac{t_{12}t_{23}e^{i\\delta}}{1+r_{12}r_{23}e^{2i\\delta}}'}</Tex>
      <Tex block>
        {isTE
          ? 'r_{jk}=\\frac{k_{zj}-k_{zk}}{k_{zj}+k_{zk}},\\qquad t_{jk}=1+r_{jk}'
          : 'r_{jk}=\\frac{k_{zj}/\\varepsilon_j-k_{zk}/\\varepsilon_k}{k_{zj}/\\varepsilon_j+k_{zk}/\\varepsilon_k},\\qquad t_{jk}=1+r_{jk}'}
      </Tex>
      <Tex block>
        {
          'k_x=k_1\\sin\\theta_i,\\quad k_{zj}=\\sqrt{k_0^2\\varepsilon_{rj}-k_x^2},\\ \\operatorname{Im}k_{zj}\\ge 0'
        }
      </Tex>

      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>With current parameters</h4>
      <Tex block>
        {`k_{z2}=${texNum(derived.kz2.re)}+i\\,${texNum(derived.kz2.im)},\\quad k_{z3}=${texNum(derived.kz3.re)}+i\\,${texNum(derived.kz3.im)}\\ \\mathrm{m^{-1}}`}
      </Tex>
      <Tex block>{`r=${texNum(cabs(derived.r))}\\,\\angle\\,${rDeg}^{\\circ}`}</Tex>
      <Tex block>{`R=${texNum(derived.R)},\\quad T=${texNum(derived.T)}`}</Tex>

      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>Common misconceptions</h4>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#555' }}>
        <li>
          Total internal reflection at the first face does not stop all transmission. If the slab is
          thin compared with its decay length 1/κ, the evanescent field reaches the far face and
          launches a propagating wave in medium 3 (frustrated TIR, the optical analog of quantum
          tunneling).
        </li>
        <li>
          The green ⟨S⟩ arrows inside an evanescent slab still point across it. A single evanescent
          wave carries no normal power, but the decaying and growing waves together do.
        </li>
        <li>
          A half-wave layer (k_z2 d = mπ) between identical media is invisible: R = 0 for any slab
          permittivity.
        </li>
      </ul>
      <ValidationList assumptions={layeredSlabModel.assumptions} results={validation} />
    </section>
  );
}
