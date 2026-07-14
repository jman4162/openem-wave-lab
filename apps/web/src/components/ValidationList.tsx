import type { ValidationResult } from '@openem/physics-core';

/** Live validate() status plus the model's assumptions - fully model-generic. */
export function ValidationList({
  assumptions,
  results,
}: {
  assumptions: string[];
  results: ValidationResult[];
}) {
  return (
    <>
      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>Assumptions</h4>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#555' }}>
        {assumptions.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <h4 style={{ margin: '6px 0 2px', fontSize: 12 }}>Validation (live)</h4>
      <ul style={{ margin: 0, paddingLeft: 4, listStyle: 'none' }}>
        {results.map((v) => (
          <li key={v.id} title={`residual ${v.residual.toExponential(2)}`}>
            <span style={{ color: v.pass ? '#16a34a' : '#dc2626' }}>{v.pass ? '●' : '✖'}</span>{' '}
            {v.description}
          </li>
        ))}
      </ul>
    </>
  );
}
