import { CopyLinkButton } from './components/CopyLinkButton';
import { ModuleNav } from './components/ModuleNav';
import { TabbedPanel } from './components/TabbedPanel';
import { TimeControls } from './components/TimeControls';
import { useMediaQuery } from './hooks/useMediaQuery';
import { getModule } from './modules/registry';
import { SceneView } from './render/SceneView';
import { useWaveLabStore } from './state/store';
import './app.css';

export function App() {
  const scene = useWaveLabStore((s) => s.scene);
  const module = getModule(scene);
  const isNarrow = useMediaQuery('(max-width: 900px)');

  const header = (
    <header className="app-header">
      <strong>{isNarrow ? 'OpenEM' : 'OpenEM Wave Lab'}</strong>
      <ModuleNav />
      <span className="legend hide-narrow">{module.legend}</span>
      <CopyLinkButton />
    </header>
  );

  if (isNarrow) {
    return (
      <div className="app">
        {header}
        <div className="mobile-body">
          <div className="mobile-canvas canvas-area">
            <SceneView key={module.id} module={module} />
          </div>
          <TimeControls />
          <TabbedPanel
            tabs={[
              { label: 'Controls', Content: module.Controls },
              { label: 'Probe', Content: module.Sidebar },
              { label: 'Equations', Content: module.Equations },
            ]}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {header}
      <div className="desktop-body">
        <aside className="panel panel-left">
          <module.Controls />
          <module.Sidebar />
        </aside>
        <main className="canvas-area">
          <SceneView key={module.id} module={module} />
        </main>
        <aside className="panel panel-right">
          <module.Equations />
        </aside>
      </div>
      <TimeControls />
    </div>
  );
}
