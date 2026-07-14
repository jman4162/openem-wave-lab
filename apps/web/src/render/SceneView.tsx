import { useEffect, useRef, useState } from 'react';
import { createRenderer, type Backend } from './createRenderer';
import { WaveScene } from './waveScene';

export function SceneView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [backend, setBackend] = useState<Backend | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void createRenderer(canvas).then(({ renderer, backend }) => {
      if (disposed) {
        renderer.dispose();
        return;
      }
      setBackend(backend);

      const waveScene = new WaveScene(renderer, canvas);

      const resize = () => {
        const parent = canvas.parentElement;
        if (!parent) return;
        renderer.setSize(parent.clientWidth, parent.clientHeight, false);
        waveScene.resize(parent.clientWidth, parent.clientHeight);
      };
      resize();
      const observer = new ResizeObserver(resize);
      if (canvas.parentElement) observer.observe(canvas.parentElement);

      let last = performance.now();
      void renderer.setAnimationLoop(() => {
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        waveScene.frame(dt);
        renderer.render(waveScene.scene, waveScene.camera);
      });

      cleanup = () => {
        observer.disconnect();
        void renderer.setAnimationLoop(null);
        waveScene.dispose();
        renderer.dispose();
      };
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {backend && (
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 12,
            fontFamily: 'monospace',
            color: '#fff',
            background: backend === 'webgpu' ? '#166534' : '#92400e',
          }}
        >
          {backend === 'webgpu' ? 'WebGPU' : 'WebGL2 fallback'}
        </span>
      )}
    </div>
  );
}
