import type { ComponentType } from 'react';
import type { Camera, Scene, WebGPURenderer } from 'three/webgpu';
import type { SceneId } from '../state/store';

/** What SceneView needs from a module's three.js scene. */
export interface SceneController {
  scene: Scene;
  camera: Camera;
  /** Advance and redraw; dt is wall-clock seconds since the previous frame. */
  frame(dt: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

/**
 * A registered experiment module. The scene factory and the three panel
 * components own all module-specific behavior; the app shell (nav, canvas,
 * time controls, URL sync) stays module-agnostic.
 */
export interface WaveModule {
  id: SceneId;
  title: string;
  /** Short color/content legend shown in the header. */
  legend: string;
  createScene(renderer: WebGPURenderer, canvas: HTMLCanvasElement): SceneController;
  Controls: ComponentType;
  Sidebar: ComponentType;
  Equations: ComponentType;
}
