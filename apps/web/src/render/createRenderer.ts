import { WebGPURenderer } from 'three/webgpu';

export type Backend = 'webgpu' | 'webgl2';

export interface RendererHandle {
  renderer: WebGPURenderer;
  backend: Backend;
}

/**
 * Create the three.js renderer. WebGPURenderer tries WebGPU and falls back to
 * its WebGL2 backend automatically; `?gfx=webgl` forces the fallback so both
 * paths stay testable.
 */
export async function createRenderer(canvas: HTMLCanvasElement): Promise<RendererHandle> {
  const forceWebGL = new URLSearchParams(window.location.search).get('gfx') === 'webgl';
  const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL });
  await renderer.init();
  const backend: Backend = (renderer.backend as unknown as { isWebGPUBackend?: boolean })
    .isWebGPUBackend
    ? 'webgpu'
    : 'webgl2';
  return { renderer, backend };
}
