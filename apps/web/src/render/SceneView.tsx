import { useEffect, useRef, useState } from 'react';
import { AxesHelper, GridHelper, PerspectiveCamera, Scene } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRenderer, type Backend } from './createRenderer';

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

      const scene = new Scene();
      scene.add(new GridHelper(4, 20, 0x666666, 0x333333));
      scene.add(new AxesHelper(1.5));

      const camera = new PerspectiveCamera(50, 1, 0.01, 100);
      camera.position.set(2.2, 1.6, 2.8);
      const controls = new OrbitControls(camera, canvas);

      const resize = () => {
        const parent = canvas.parentElement;
        if (!parent) return;
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      if (canvas.parentElement) observer.observe(canvas.parentElement);

      void renderer.setAnimationLoop(() => {
        controls.update();
        renderer.render(scene, camera);
      });

      cleanup = () => {
        observer.disconnect();
        void renderer.setAnimationLoop(null);
        controls.dispose();
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
