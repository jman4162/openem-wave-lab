import { SceneView } from './render/SceneView';

export function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ padding: '8px 16px', borderBottom: '1px solid #ddd' }}>
        <strong>OpenEM Wave Lab</strong>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SceneView />
      </div>
    </div>
  );
}
