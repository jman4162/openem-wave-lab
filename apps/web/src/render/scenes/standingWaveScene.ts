import {
  BoxGeometry,
  GridHelper,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  type WebGPURenderer,
} from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  deriveStandingWave,
  standingWaveEnvelopeAt,
  standingWaveModel,
  type StandingWaveState,
} from '@openem/physics-core';
import { useWaveLabStore } from '../../state/store';
import { WaveCurve, makeMarker } from '../waveCurve';
import type { SceneController } from '../../modules/types';

const N = 512;
/** Domain z in [-4 lambda, 0]; wall at scene x = +2. */
const DOMAIN_LAMBDAS = 4;
const HALF_W = 2;
/** Scene y per E0 (field reaches 2 E0 at full reflection). */
const Y_SCALE = 0.42;
/** Baseline offset for the time-averaged intensity curve. */
const INTENSITY_BASE = -1.05;
const INTENSITY_SCALE = 0.35;

/**
 * Standing-wave curves: instantaneous E(z,t) (red), +-|E(z)| envelope (gray),
 * and time-averaged intensity on its own labeled baseline (blue) so it can't
 * be mistaken for a field. Single-frequency, so the phasor is cached per
 * param change and only rotated by e^{-i omega t} each frame.
 */
export class StandingWaveScene implements SceneController {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(45, 1.6, 0.01, 100);

  private controls: OrbitControls;
  private field: WaveCurve;
  private envTop: WaveCurve;
  private envBottom: WaveCurve;
  private intensity: WaveCurve;
  private probeMarker;
  private wall: Mesh;
  private xsScene = new Float32Array(N);
  private phasor = new Float32Array(2 * N);
  private envValues = new Float32Array(N);
  private ys = new Float32Array(N);
  private lastParams: StandingWaveState | null = null;

  constructor(_renderer: WebGPURenderer, canvas: HTMLCanvasElement) {
    this.camera.position.set(0, 0.55, 4.3);
    this.controls = new OrbitControls(this.camera, canvas);

    const grid = new GridHelper(4.4, 22, 0x333333, 0x222222);
    grid.position.y = -1.5;
    this.scene.add(grid);

    this.field = new WaveCurve(this.scene, N, 0xe11d48);
    this.envTop = new WaveCurve(this.scene, N, 0x9ca3af);
    this.envBottom = new WaveCurve(this.scene, N, 0x9ca3af);
    this.intensity = new WaveCurve(this.scene, N, 0x0ea5e9);
    this.probeMarker = makeMarker(this.scene, 0xffffff);

    this.wall = new Mesh(
      new BoxGeometry(0.05, 2.2, 0.5),
      new MeshBasicMaterial({ color: 0x9ca3af }),
    );
    this.wall.position.set(HALF_W + 0.03, 0, 0);
    this.scene.add(this.wall);

    for (let i = 0; i < N; i++) {
      this.xsScene[i] = -HALF_W + (2 * HALF_W * i) / (N - 1);
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private recompute(params: StandingWaveState): void {
    const derived = deriveStandingWave(params);
    const spanM = DOMAIN_LAMBDAS * derived.wavelengthM;
    const points = new Float32Array(3 * N);
    for (let i = 0; i < N; i++) {
      points[3 * i + 2] = -spanM + (spanM * i) / (N - 1);
    }
    const sample = standingWaveModel.sampleField(params, points, 0);
    this.phasor.set(sample.Ephasor);

    let maxIntensity = 0;
    for (let i = 0; i < N; i++) {
      const z = -spanM + (spanM * i) / (N - 1);
      const env = standingWaveEnvelopeAt(params, derived, z);
      this.envValues[i] = env;
      maxIntensity = Math.max(maxIntensity, 0.5 * env * env);
    }

    const envYs = new Float32Array(N);
    const envYsNeg = new Float32Array(N);
    const intYs = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const e = (this.envValues[i] ?? 0) * Y_SCALE;
      envYs[i] = e;
      envYsNeg[i] = -e;
      const intensity = 0.5 * (this.envValues[i] ?? 0) ** 2;
      intYs[i] =
        INTENSITY_BASE + (maxIntensity > 0 ? (intensity / maxIntensity) * INTENSITY_SCALE : 0);
    }
    this.envTop.setPositions(this.xsScene, envYs);
    this.envBottom.setPositions(this.xsScene, envYsNeg);
    this.intensity.setPositions(this.xsScene, intYs);

    this.lastParams = params;
  }

  frame(dt: number): void {
    const state = useWaveLabStore.getState();
    if (state.playing) {
      useWaveLabStore.setState({ tau: state.tau + dt * state.speed });
    }
    const { standingWave, tau, probeZSw } = useWaveLabStore.getState();
    if (standingWave !== this.lastParams) this.recompute(standingWave);

    const omegaT = 2 * Math.PI * tau;
    const c = Math.cos(omegaT);
    const s = Math.sin(omegaT);
    for (let i = 0; i < N; i++) {
      this.ys[i] = ((this.phasor[2 * i] ?? 0) * c + (this.phasor[2 * i + 1] ?? 0) * s) * Y_SCALE;
    }
    this.field.setPositions(this.xsScene, this.ys);

    // Probe rides the instantaneous field at z = probeZSw (in wavelengths).
    const frac = 1 + probeZSw / DOMAIN_LAMBDAS; // probeZSw in [-4, 0] -> [0, 1]
    const idx = Math.max(0, Math.min(N - 1, Math.round(frac * (N - 1))));
    this.probeMarker.position.set(this.xsScene[idx] ?? 0, this.ys[idx] ?? 0, 0);

    this.controls.update();
  }

  dispose(): void {
    this.controls.dispose();
    this.field.dispose();
    this.envTop.dispose();
    this.envBottom.dispose();
    this.intensity.dispose();
  }
}
