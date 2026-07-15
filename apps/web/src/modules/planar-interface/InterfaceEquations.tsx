import { cabs, carg, derivePlanarInterface, planarInterfaceModel } from '@openem/physics-core';
import { Tex, texNum } from '../../components/Tex';
import { ValidationList } from '../../components/ValidationList';
import { useWaveLabStore } from '../../state/store';

export function InterfaceEquations() {
  const params = useWaveLabStore((s) => s.planarInterface);
  const derived = derivePlanarInterface(params);
  const validation = planarInterfaceModel.validate(params);
  const isTE = params.polarization === 'TE';
  const rDeg = ((carg(derived.r) * 180) / Math.PI).toFixed(1);

  return (
    <section style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 13 }}>
        Governing equations ({params.polarization})
      </h3>
      <Tex block>
        {isTE
          ? '\\tilde{E}_y(z<0)=E_0e^{ik_xx}\\left(e^{ik_{z1}z}+r\\,e^{-ik_{z1}z}\\right)'
          : '\\tilde{H}_y(z<0)=H_0e^{ik_xx}\\left(e^{ik_{z1}z}+r\\,e^{-ik_{z1}z}\\right)'}
      </Tex>
      <Tex block>
        {isTE
          ? '\\tilde{E}_y(z>0)=E_0\\,t\\,e^{ik_xx}e^{ik_{z2}z}'
          : '\\tilde{H}_y(z>0)=H_0\\,t\\,e^{ik_xx}e^{ik_{z2}z}'}
      </Tex>
      <Tex block>
        {isTE
          ? 'r_{TE}=\\frac{k_{z1}/\\mu_1-k_{z2}/\\mu_2}{k_{z1}/\\mu_1+k_{z2}/\\mu_2},\\qquad t=1+r'
          : 'r_{TM}^{(H)}=\\frac{k_{z1}/\\varepsilon_1-k_{z2}/\\varepsilon_{c2}}{k_{z1}/\\varepsilon_1+k_{z2}/\\varepsilon_{c2}},\\qquad t=1+r'}
      </Tex>
      <Tex block>
        {
          'k_x=k_1\\sin\\theta_i \\text{ (conserved = Snell)},\\quad k_{z2}=\\sqrt{k_2^2-k_x^2},\\ \\operatorname{Im}k_{z2}\\ge 0'
        }
      </Tex>

      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>With current parameters</h4>
      <Tex block>
        {`k_x=${texNum(derived.kx)},\\quad k_{z1}=${texNum(derived.kz1)}\\ \\mathrm{rad/m}`}
      </Tex>
      <Tex block>
        {`k_{z2}=${texNum(derived.kz2.re)}+i\\,${texNum(derived.kz2.im)}\\ \\mathrm{m^{-1}}`}
      </Tex>
      <Tex block>
        {`r=${texNum(cabs(derived.r))}\\,\\angle\\,${rDeg}^{\\circ},\\quad R=${texNum(derived.R)},\\quad T=${texNum(derived.T)}`}
      </Tex>

      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>Common misconceptions</h4>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#555' }}>
        <li>
          Total internal reflection does not mean zero field in medium 2: an evanescent field decays
          as e^(−z/δ) with δ = 1/Im(k_z2), carrying power along the interface but none across it
          (watch the green ⟨S⟩ arrows).
        </li>
        <li>
          Power flow is computed from ½Re&#123;Ẽ×H̃*&#125;, never assumed from the wave vector.
        </li>
        <li>
          The heatmap shows the continuous scalar (Ey for TE, Hy for TM); its smoothness across the
          interface line is the tangential boundary condition, visible.
        </li>
      </ul>
      <ValidationList assumptions={planarInterfaceModel.assumptions} results={validation} />
    </section>
  );
}
