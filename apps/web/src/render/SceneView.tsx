import { useEffect, useRef, useState } from 'react';
import type { WaveModule } from '../modules/types';
import { createRenderer, type Backend } from './createRenderer';

/**
 * Owns the canvas, renderer, and frame loop for one module's scene.
 * Mount with key={module.id} so switching modules remounts cleanly.
 */
export function SceneView({ module }: { module: WaveModule }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const perfRef = useRef<HTMLDivElement>(null);
  const [backend, setBackend] = useState<Backend | null>(null);
  const showPerf = new URLSearchParams(window.location.search).get('perf') === '1';

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

      const controller = module.createScene(renderer, canvas);

      const resize = () => {
        const parent = canvas.parentElement;
        if (!parent) return;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(parent.clientWidth, parent.clientHeight, false);
        controller.resize(parent.clientWidth, parent.clientHeight);
      };
      resize();
      const observer = new ResizeObserver(resize);
      if (canvas.parentElement) observer.observe(canvas.parentElement);

      // ?perf=1 overlay: rolling frame stats written straight to the DOM.
      let frameCount = 0;
      let frameMsSum = 0;
      let frameMsMax = 0;
      let lastReport = performance.now();

      let last = performance.now();
      void renderer.setAnimationLoop(() => {
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        const t0 = showPerf ? performance.now() : 0;
        controller.frame(dt);
        renderer.render(controller.scene, controller.camera);
        if (showPerf && perfRef.current) {
          const ms = performance.now() - t0;
          frameCount++;
          frameMsSum += ms;
          frameMsMax = Math.max(frameMsMax, ms);
          if (now - lastReport > 250) {
            perfRef.current.textContent = `frame ${(frameMsSum / frameCount).toFixed(1)} ms (max ${frameMsMax.toFixed(1)})`;
            frameCount = 0;
            frameMsSum = 0;
            frameMsMax = 0;
            lastReport = now;
          }
        }
      });

      cleanup = () => {
        observer.disconnect();
        void renderer.setAnimationLoop(null);
        controller.dispose();
        renderer.dispose();
      };
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [module, showPerf]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} className="scene-canvas" />
      {backend && (
        <span
          aria-hidden="true"
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
      {showPerf && <div ref={perfRef} className="perf-overlay" />}
    </div>
  );
}
