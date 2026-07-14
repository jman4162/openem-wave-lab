import { CopyLinkButton } from './components/CopyLinkButton';
import { EquationPanel } from './components/EquationPanel';
import { ParameterControls } from './components/ParameterControls';
import { PolarizationEllipse } from './components/PolarizationEllipse';
import { ProbeReadout } from './components/ProbeReadout';
import { TimeControls } from './components/TimeControls';
import { SceneView } from './render/SceneView';

export function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <strong>OpenEM Wave Lab</strong>
        <span style={{ color: '#666', fontSize: 13, flex: 1 }}>
          Plane wave — E (red), η₀H (blue), k (amber)
        </span>
        <CopyLinkButton />
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
          <ProbeReadout />
          <PolarizationEllipse />
        </aside>
        <main style={{ flex: 1, minWidth: 0, background: '#111' }}>
          <SceneView />
        </main>
        <aside
          style={{
            width: 340,
            padding: 12,
            borderLeft: '1px solid #ddd',
            overflowY: 'auto',
          }}
        >
          <EquationPanel />
        </aside>
      </div>
      <TimeControls />
    </div>
  );
}
