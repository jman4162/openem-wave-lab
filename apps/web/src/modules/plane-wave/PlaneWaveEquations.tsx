import { derivePlaneWave, planeWaveModel, cabs, carg } from '@openem/physics-core';
import { useWaveLabStore } from '../../state/store';
import { Tex, texNum } from '../../components/Tex';
import { ValidationList } from '../../components/ValidationList';

export function PlaneWaveEquations() {
  const params = useWaveLabStore((s) => s.planeWave);
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
      <ValidationList assumptions={planeWaveModel.assumptions} results={validation} />
    </section>
  );
}
