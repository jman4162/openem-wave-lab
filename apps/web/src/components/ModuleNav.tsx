import { useWaveLabStore } from '../state/store';
import { MODULES } from '../modules/registry';

export function ModuleNav() {
  const scene = useWaveLabStore((s) => s.scene);
  const setScene = useWaveLabStore((s) => s.setScene);
  return (
    <nav style={{ display: 'flex', gap: 4 }}>
      {MODULES.map((m) => (
        <button
          key={m.id}
          onClick={() => setScene(m.id)}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid #ccc',
            background: m.id === scene ? '#1d4ed8' : 'transparent',
            color: m.id === scene ? '#fff' : 'inherit',
            cursor: 'pointer',
          }}
        >
          {m.title}
        </button>
      ))}
    </nav>
  );
}
