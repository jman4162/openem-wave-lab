import katex from 'katex';
import 'katex/dist/katex.min.css';
import { derivePlaneWave, planeWaveModel, cabs, carg } from '@openem/physics-core';
import { useWaveLabStore } from '../state/store';

/** LaTeX scientific notation, e.g. 2.99e8 -> "3.00\times10^{8}". */
function texNum(value: number, digits = 3): string {
  if (value === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(value)));
  if (exp >= -2 && exp <= 3) return value.toPrecision(digits);
  const mantissa = value / 10 ** exp;
  return `${mantissa.toPrecision(digits)}\\times10^{${exp}}`;
}

const Tex = ({ children, block = false }: { children: string; block?: boolean }) => (
  <span
    dangerouslySetInnerHTML={{
      __html: katex.renderToString(children, { displayMode: block, throwOnError: false }),
    }}
  />
);

export function EquationPanel() {
  const params = useWaveLabStore((s) => s.params);
  const derived = derivePlaneWave(params);
  const etaDeg = ((carg(derived.eta) * 180) / Math.PI).toFixed(1);
  const validation = planeWaveModel.validate(params);

  return (
    <section style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 13 }}>Governing equations</h3>
      <Tex block>
        {'\\mathbf{E}(z,t)=\\operatorname{Re}\\{\\tilde{\\mathbf{E}}(z)\\,e^{-i\\omega t}\\}'}
      </Tex>
      <Tex block>
        {
          '\\tilde{\\mathbf{E}}(z)=\\left(E_{0x}\\hat{\\mathbf{x}}+E_{0y}e^{i\\delta}\\hat{\\mathbf{y}}\\right)e^{-\\alpha z}e^{i\\beta z}'
        }
      </Tex>
      <Tex block>
        {
          '\\tilde{\\mathbf{H}}=\\tfrac{1}{\\eta}\\,\\hat{\\mathbf{z}}\\times\\tilde{\\mathbf{E}},\\qquad \\langle\\mathbf{S}\\rangle=\\tfrac{1}{2}\\operatorname{Re}\\{\\tilde{\\mathbf{E}}\\times\\tilde{\\mathbf{H}}^{*}\\}'
        }
      </Tex>
      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>With current parameters</h4>
      <Tex block>
        {`k=\\beta+i\\alpha=${texNum(derived.beta)}+i\\,${texNum(derived.alpha)}\\ \\mathrm{m^{-1}}`}
      </Tex>
      <Tex block>
        {`\\lambda=${texNum(derived.wavelengthM)}\\ \\mathrm{m},\\quad v_p=${texNum(derived.phaseVelocity)}\\ \\mathrm{m/s}`}
      </Tex>
      <Tex block>
        {`\\eta=${texNum(cabs(derived.eta))}\\,\\angle\\,${etaDeg}^{\\circ}\\ \\Omega,\\quad \\tan\\delta_c=${texNum(derived.lossTangent)}`}
      </Tex>
      {derived.skinDepthM !== null && (
        <Tex block>{`\\delta_s=1/\\alpha=${texNum(derived.skinDepthM)}\\ \\mathrm{m}`}</Tex>
      )}

      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>Assumptions</h4>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#555' }}>
        {planeWaveModel.assumptions.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>

      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>Validation (live)</h4>
      <ul style={{ margin: 0, paddingLeft: 4, listStyle: 'none' }}>
        {validation.map((v) => (
          <li key={v.id} title={`residual ${v.residual.toExponential(2)}`}>
            <span style={{ color: v.pass ? '#16a34a' : '#dc2626' }}>{v.pass ? '●' : '✖'}</span>{' '}
            {v.description}
          </li>
        ))}
      </ul>
    </section>
  );
}
