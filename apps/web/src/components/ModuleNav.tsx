import { useWaveLabStore } from '../state/store';
import { MODULES } from '../modules/registry';

export function ModuleNav() {
  const scene = useWaveLabStore((s) => s.scene);
  const setScene = useWaveLabStore((s) => s.setScene);
  return (
    <nav className="module-nav" aria-label="Experiment modules">
      {MODULES.map((m) => (
        <button
          key={m.id}
          onClick={() => setScene(m.id)}
          aria-current={m.id === scene ? 'page' : undefined}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid #ccc',
            background: m.id === scene ? '#1d4ed8' : 'transparent',
            color: m.id === scene ? '#fff' : 'inherit',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {m.title}
        </button>
      ))}
    </nav>
  );
}
