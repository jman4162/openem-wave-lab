import {
  ArrowHelper,
  BufferAttribute,
  BufferGeometry,
  GridHelper,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  type WebGPURenderer,
} from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { derivePlaneWave, planeWaveModel, ETA_0 } from '@openem/physics-core';
import { useWaveLabStore } from '../../state/store';
import { ArrowField } from '../arrowField';

const N = 48;
/** Visual length of the propagation axis, scene units. */
const L = 4;
/** Physical domain shown, in wavelengths. */
const DOMAIN_WAVELENGTHS = 2;
/** Scene units per V/m for E arrows. */
const E_SCALE = 0.55;
/** H arrows are drawn as eta0*H so vacuum E and H arrows match in size. */
const H_SCALE = E_SCALE * ETA_0;

export const COLORS = {
  E: 0xe11d48,
  H: 0x0ea5e9,
  k: 0xf59e0b,
  probe: 0xffffff,
};

/**
 * Owns the three.js scene graph and the animation loop body. Reads state via
 * zustand's getState() each frame and writes tau back with setState - no React
 * involvement per frame (see docs/architecture.md).
 */
export class PlaneWaveScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(50, 1, 0.01, 100);
  private controls: OrbitControls;
  /** Rotated so physical x (E for delta=0) points up on screen. */
  private group = new Group();
  private eField: ArrowField;
  private hField: ArrowField;
  private ribbon: Line;
  private ribbonPositions = new Float32Array(3 * N);
  private probeMarker: Mesh;
  private points = new Float32Array(3 * N);
  private basePositions = new Float32Array(3 * N);
  private eVectors = new Float32Array(3 * N);
  private hVectors = new Float32Array(3 * N);

  constructor(renderer: WebGPURenderer, canvas: HTMLCanvasElement) {
    void renderer; // reserved for backend-specific tuning
    this.camera.position.set(3.2, 1.4, 2.4);
    this.controls = new OrbitControls(this.camera, canvas);

    this.scene.add(new GridHelper(6, 24, 0x444444, 0x2a2a2a));
    this.group.rotation.z = Math.PI / 2;
    this.scene.add(this.group);

    this.eField = new ArrowField(this.group, N, COLORS.E);
    this.hField = new ArrowField(this.group, N, COLORS.H);

    const ribbonGeo = new BufferGeometry();
    ribbonGeo.setAttribute('position', new BufferAttribute(this.ribbonPositions, 3));
    this.ribbon = new Line(ribbonGeo, new LineBasicMaterial({ color: COLORS.E }));
    this.group.add(this.ribbon);

    const kArrow = new ArrowHelper(
      new Vector3(0, 0, 1),
      new Vector3(0, 0, -L / 2 - 0.4),
      0.8,
      COLORS.k,
      0.12,
      0.06,
    );
    this.group.add(kArrow);

    this.probeMarker = new Mesh(
      new SphereGeometry(0.045, 16, 16),
      new MeshBasicMaterial({ color: COLORS.probe }),
    );
    this.group.add(this.probeMarker);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Advance and redraw. dt is wall-clock seconds since the previous frame. */
  frame(dt: number): void {
    const state = useWaveLabStore.getState();
    if (state.playing) {
      useWaveLabStore.setState({ tau: state.tau + dt * state.speed });
    }

    const { planeWave: params, tau, probeZeta } = useWaveLabStore.getState();
    const derived = derivePlaneWave(params);
    const zMax = DOMAIN_WAVELENGTHS * derived.wavelengthM;
    const sceneZPerMeter = L / zMax;
    const t = tau * derived.periodS;

    for (let i = 0; i < N; i++) {
      const z = (i / (N - 1)) * zMax;
      this.points[3 * i] = 0;
      this.points[3 * i + 1] = 0;
      this.points[3 * i + 2] = z;
      this.basePositions[3 * i] = 0;
      this.basePositions[3 * i + 1] = 0;
      this.basePositions[3 * i + 2] = z * sceneZPerMeter - L / 2;
    }

    const sample = planeWaveModel.sampleField(params, this.points, t);
    for (let i = 0; i < N; i++) {
      const ex = (sample.E[3 * i] ?? 0) * E_SCALE;
      const ey = (sample.E[3 * i + 1] ?? 0) * E_SCALE;
      this.eVectors[3 * i] = ex;
      this.eVectors[3 * i + 1] = ey;
      this.eVectors[3 * i + 2] = 0;
      this.hVectors[3 * i] = (sample.H[3 * i] ?? 0) * H_SCALE;
      this.hVectors[3 * i + 1] = (sample.H[3 * i + 1] ?? 0) * H_SCALE;
      this.hVectors[3 * i + 2] = 0;
      this.ribbonPositions[3 * i] = ex;
      this.ribbonPositions[3 * i + 1] = ey;
      this.ribbonPositions[3 * i + 2] = this.basePositions[3 * i + 2] ?? 0;
    }

    this.eField.update(this.basePositions, this.eVectors);
    this.hField.update(this.basePositions, this.hVectors);
    const posAttr = this.ribbon.geometry.getAttribute('position') as BufferAttribute;
    posAttr.needsUpdate = true;

    const probeZ = probeZeta * derived.wavelengthM;
    this.probeMarker.position.set(0, 0, probeZ * sceneZPerMeter - L / 2);

    this.controls.update();
  }

  dispose(): void {
    this.controls.dispose();
  }
}
