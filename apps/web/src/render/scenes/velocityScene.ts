import { GridHelper, PerspectiveCamera, Scene, type WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { deriveVelocity, velocityFieldsAt, type VelocityState } from '@openem/physics-core';
import { useWaveLabStore } from '../../state/store';
import { WaveCurve, makeMarker } from '../waveCurve';
import type { SceneController } from '../../modules/types';

const N = 512;
/** Scene half-width the physical domain maps onto. */
const HALF_W = 2;
/** Scene y per unit psi (beat amplitude reaches 2). */
const Y_SCALE = 0.5;

/**
 * 1D wave curves for the velocity module. Beat view: field + envelope with an
 * amber marker riding a carrier crest (v_p) and a green marker riding the
 * envelope peak (v_g) - watch amber outrun green. Pulse view: a Gaussian
 * pulse that loops through the domain, spreading anew on each pass.
 */
export class VelocityScene implements SceneController {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(45, 1.6, 0.01, 100);

  private controls: OrbitControls;
  private field: WaveCurve;
  private envTop: WaveCurve;
  private envBottom: WaveCurve;
  private crestMarker;
  private envelopeMarker;
  private xsScene = new Float32Array(N);
  private ys = new Float32Array(N);
  private ysEnv = new Float32Array(N);
  private ysEnvNeg = new Float32Array(N);

  constructor(_renderer: WebGPURenderer, canvas: HTMLCanvasElement) {
    this.camera.position.set(0, 0.6, 4.2);
    this.controls = new OrbitControls(this.camera, canvas);

    const grid = new GridHelper(4.4, 22, 0x333333, 0x222222);
    grid.position.y = -1.15;
    this.scene.add(grid);

    this.field = new WaveCurve(this.scene, N, 0xe11d48);
    this.envTop = new WaveCurve(this.scene, N, 0x9ca3af);
    this.envBottom = new WaveCurve(this.scene, N, 0x9ca3af);
    this.crestMarker = makeMarker(this.scene, 0xf59e0b);
    this.envelopeMarker = makeMarker(this.scene, 0x34d399);

    for (let i = 0; i < N; i++) {
      this.xsScene[i] = -HALF_W + (2 * HALF_W * i) / (N - 1);
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  frame(dt: number): void {
    const state = useWaveLabStore.getState();
    if (state.playing) {
      useWaveLabStore.setState({ tau: state.tau + dt * state.speed });
    }
    const { velocity, velocityView, tau } = useWaveLabStore.getState();
    const derived = deriveVelocity(velocity);
    const t = tau * derived.periodS;

    if (velocityView === 'beat') {
      this.renderBeat(velocity, derived, t);
    } else {
      this.renderPulse(velocity, derived, t);
    }
    this.controls.update();
  }

  private renderBeat(
    _state: VelocityState,
    derived: ReturnType<typeof deriveVelocity>,
    t: number,
  ): void {
    // Domain: two beat wavelengths (falls back to 8 carrier wavelengths when
    // non-dispersive detuning gives a huge beat length).
    const span = Math.min(2 * derived.beatWavelengthM, 40 * derived.wavelengthM);
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * span;
      const f = velocityFieldsAt(derived, x, t);
      this.ys[i] = f.psiBeat * Y_SCALE;
      this.ysEnv[i] = f.envelopeBeat * Y_SCALE;
      this.ysEnvNeg[i] = -f.envelopeBeat * Y_SCALE;
    }
    this.field.setPositions(this.xsScene, this.ys);
    this.envTop.setPositions(this.xsScene, this.ysEnv);
    this.envBottom.setPositions(this.xsScene, this.ysEnvNeg);
    this.envTop.line.visible = true;
    this.envBottom.line.visible = true;

    const toScene = (x: number): number => -HALF_W + 2 * HALF_W * (x / span);
    const wrap = (x: number): number => ((x % span) + span) % span;

    // Amber: carrier crest at the phase velocity of the mean carrier.
    const vCrest = (derived.omega1 + derived.omega2) / (derived.k1 + derived.k2);
    const xCrest = wrap(vCrest * t);
    const fCrest = velocityFieldsAt(derived, xCrest, t);
    this.crestMarker.visible = true;
    this.crestMarker.position.set(toScene(xCrest), fCrest.psiBeat * Y_SCALE, 0);

    // Green: envelope peak at deltaOmega/deltaK (the group velocity).
    const xEnv = wrap(derived.envelopeVelocity * t);
    const fEnv = velocityFieldsAt(derived, xEnv, t);
    this.envelopeMarker.position.set(toScene(xEnv), fEnv.envelopeBeat * Y_SCALE + 0.06, 0);
  }

  private renderPulse(
    _state: VelocityState,
    derived: ReturnType<typeof deriveVelocity>,
    t: number,
  ): void {
    // The pulse loops through the domain; each pass restarts unspread.
    const sigma0 = derived.sigmaXM;
    const span = 16 * sigma0;
    const startCenter = 2.5 * sigma0;
    const travel = span - 5 * sigma0;
    const tWrap = travel / derived.vG;
    const tEff = tWrap > 0 ? ((t % tWrap) + tWrap) % tWrap : 0;

    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * span - startCenter;
      const f = velocityFieldsAt(derived, x, tEff);
      this.ys[i] = f.psiPulse * 2 * Y_SCALE;
      this.ysEnv[i] = f.envelopePulse * 2 * Y_SCALE;
      this.ysEnvNeg[i] = -f.envelopePulse * 2 * Y_SCALE;
    }
    this.field.setPositions(this.xsScene, this.ys);
    this.envTop.setPositions(this.xsScene, this.ysEnv);
    this.envBottom.setPositions(this.xsScene, this.ysEnvNeg);

    // Green marker rides the envelope center at v_g; amber hidden (the
    // chirped carrier has no single crest velocity to ride honestly).
    this.crestMarker.visible = false;
    const xCenter = derived.vG * tEff;
    const sceneX = -HALF_W + (2 * HALF_W * (xCenter + startCenter)) / span;
    const fC = velocityFieldsAt(derived, xCenter, tEff);
    this.envelopeMarker.position.set(sceneX, fC.envelopePulse * 2 * Y_SCALE + 0.06, 0);
  }

  dispose(): void {
    this.controls.dispose();
    this.field.dispose();
    this.envTop.dispose();
    this.envBottom.dispose();
  }
}
