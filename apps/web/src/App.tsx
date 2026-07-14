import { CopyLinkButton } from './components/CopyLinkButton';
import { ModuleNav } from './components/ModuleNav';
import { TimeControls } from './components/TimeControls';
import { getModule } from './modules/registry';
import { SceneView } from './render/SceneView';
import { useWaveLabStore } from './state/store';

export function App() {
  const scene = useWaveLabStore((s) => s.scene);
  const module = getModule(scene);

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
        <ModuleNav />
        <span style={{ color: '#666', fontSize: 13, flex: 1 }}>{module.legend}</span>
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
          <module.Controls />
          <module.Sidebar />
        </aside>
        <main style={{ flex: 1, minWidth: 0, background: '#111' }}>
          <SceneView key={module.id} module={module} />
        </main>
        <aside
          style={{
            width: 340,
            padding: 12,
            borderLeft: '1px solid #ddd',
            overflowY: 'auto',
          }}
        >
          <module.Equations />
        </aside>
      </div>
      <TimeControls />
    </div>
  );
}
