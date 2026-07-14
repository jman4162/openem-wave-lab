import { ParameterControls } from './components/ParameterControls';
import { TimeControls } from './components/TimeControls';
import { SceneView } from './render/SceneView';

export function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ padding: '8px 16px', borderBottom: '1px solid #ddd' }}>
        <strong>OpenEM Wave Lab</strong>
        <span style={{ marginLeft: 12, color: '#666', fontSize: 13 }}>
          Plane wave — E (red), η₀H (blue), k (amber)
        </span>
      </header>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside
          style={{
            width: 280,
            padding: 12,
            borderRight: '1px solid #ddd',
            overflowY: 'auto',
          }}
        >
          <ParameterControls />
        </aside>
        <main style={{ flex: 1, minWidth: 0, background: '#111' }}>
          <SceneView />
        </main>
      </div>
      <TimeControls />
    </div>
  );
}
