import {
  ArrowHelper,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  type WebGPURenderer,
} from 'three/webgpu';
import { deriveLayeredSlab, layeredSlabModel, type LayeredSlabState } from '@openem/physics-core';
import { useWaveLabStore } from '../../state/store';
import { HeatmapLayer } from '../heatmapLayer';
import { smallViewport } from '../quality';
import type { SceneController } from '../../modules/types';

/** Physical domain in medium-1 wavelengths: x in [-2, 2], z in [-1.5, 2.5]. */
const X_SPAN = 4;
const Z_MIN = -1.5;
const Z_MAX = 2.5;
const QUAD = 2.4;
/** Scene units per medium-1 wavelength. */
const UNIT = QUAD / X_SPAN;

const S_ARROWS_X = 7;
const S_ARROWS_Z = 8;
/** Rows of <S> arrows: a fixed grid plus one row at the slab's mid-plane. */
const S_ROWS = S_ARROWS_Z + 1;

const toSceneX = (xOverLambda: number): number => xOverLambda * UNIT;
const toSceneY = (zOverLambda: number): number => (zOverLambda - (Z_MIN + Z_MAX) / 2) * UNIT;

/**
 * Total-field heatmap of the continuous scalar (Ey for TE, Hy for TM) across
 * medium 1, the slab and medium 3. Its smoothness at both faces is the
 * boundary condition. k arrows show phase directions where the wave
 * propagates; <S> arrows are computed from (1/2)Re{E x H*} on a coarse grid.
 * Under frustrated TIR they keep pointing across the evanescent slab, which
 * is the tunneled power. The color scale is the largest |psi| on the grid, so
 * resonant build-up inside a Fabry-Perot slab is shown at its true size.
 */
export class SlabScene implements SceneController {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-2, 2, 1.35, -1.35, 0.1, 10);

  private group = new Group();
  private layer: HeatmapLayer;
  private exitFace: Mesh;
  private kArrows: {
    incident: ArrowHelper;
    reflected: ArrowHelper;
    slab: ArrowHelper;
    transmitted: ArrowHelper;
  };
  private sArrows: ArrowHelper[] = [];
  private lastParams: LayeredSlabState | null = null;
  /** Quality tier chosen once at construction (docs/architecture.md). */
  private readonly grid = smallViewport() ? 160 : 224;
  private gridPointsBuf: Float32Array;
  private scalarBuf: Float32Array;

  constructor(_renderer: WebGPURenderer, _canvas: HTMLCanvasElement) {
    this.camera.position.set(0, 0, 5);
    this.scene.add(this.group);

    this.gridPointsBuf = new Float32Array(3 * this.grid * this.grid);
    this.scalarBuf = new Float32Array(2 * this.grid * this.grid);
    this.layer = new HeatmapLayer(this.group, this.grid, QUAD, QUAD);

    const mkFace = (): Mesh => {
      const face = new Mesh(
        new PlaneGeometry(QUAD, 0.012),
        new MeshBasicMaterial({ color: 0xe5e7eb }),
      );
      face.position.z = 0.002;
      this.group.add(face);
      return face;
    };
    mkFace().position.y = toSceneY(0);
    this.exitFace = mkFace();

    const mkArrow = (color: number): ArrowHelper => {
      const arrow = new ArrowHelper(new Vector3(0, 1, 0), new Vector3(), 0.5, color, 0.1, 0.055);
      arrow.position.z = 0.004;
      this.group.add(arrow);
      return arrow;
    };
    this.kArrows = {
      incident: mkArrow(0xf59e0b),
      reflected: mkArrow(0xf59e0b),
      slab: mkArrow(0xf59e0b),
      transmitted: mkArrow(0xf59e0b),
    };

    for (let i = 0; i < S_ARROWS_X * S_ROWS; i++) {
      const arrow = new ArrowHelper(
        new Vector3(0, 1, 0),
        new Vector3(),
        0.1,
        0x34d399,
        0.045,
        0.028,
      );
      arrow.position.z = 0.003;
      this.group.add(arrow);
      this.sArrows.push(arrow);
    }
  }

  resize(width: number, height: number): void {
    const aspect = width / height;
    const halfH = Math.max(1.35, 1.5 / aspect);
    const halfW = halfH * aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  private recompute(params: LayeredSlabState): void {
    const derived = deriveLayeredSlab(params);
    const lambda = derived.wavelength1M;
    const dL = params.thicknessLambda1;

    const n = this.grid;
    for (let iz = 0; iz < n; iz++) {
      const z = (Z_MIN + ((Z_MAX - Z_MIN) * iz) / (n - 1)) * lambda;
      for (let ix = 0; ix < n; ix++) {
        const i = iz * n + ix;
        this.gridPointsBuf[3 * i] = (-X_SPAN / 2 + (X_SPAN * ix) / (n - 1)) * lambda;
        this.gridPointsBuf[3 * i + 1] = 0;
        this.gridPointsBuf[3 * i + 2] = z;
      }
    }
    const sample = layeredSlabModel.sampleField(params, this.gridPointsBuf, 0);
    const source = params.polarization === 'TE' ? sample.Ephasor : sample.Hphasor;
    let maxAbs = 0;
    for (let i = 0; i < n * n; i++) {
      const re = source[6 * i + 2] ?? 0;
      const im = source[6 * i + 3] ?? 0;
      this.scalarBuf[2 * i] = re;
      this.scalarBuf[2 * i + 1] = im;
      maxAbs = Math.max(maxAbs, Math.hypot(re, im));
    }
    this.layer.setPhasors(this.scalarBuf, maxAbs);

    // The exit face sits at z = d; hide it when it leaves the domain or merges with z = 0.
    this.exitFace.position.y = toSceneY(dL);
    this.exitFace.visible = dL > 0.005 && dL < Z_MAX;

    // k arrows: phase directions in each region where the wave propagates.
    const theta = (params.thetaDeg * Math.PI) / 180;
    const entry = new Vector3(0, toSceneY(0), 0.004);
    const dIn = new Vector3(Math.sin(theta), Math.cos(theta), 0);
    this.kArrows.incident.position.copy(entry.clone().addScaledVector(dIn, -0.55));
    this.kArrows.incident.setDirection(dIn);
    this.kArrows.incident.setLength(0.45, 0.1, 0.055);
    this.kArrows.reflected.position.copy(entry);
    this.kArrows.reflected.setDirection(new Vector3(Math.sin(theta), -Math.cos(theta), 0));
    this.kArrows.reflected.setLength(0.45, 0.1, 0.055);

    const slabPropagates = derived.slabRegime === 'propagating';
    const slabLength = 0.8 * dL * UNIT;
    this.kArrows.slab.visible = slabPropagates && slabLength > 0.12;
    let exitX = 0;
    if (slabPropagates) {
      const dSlab = new Vector3(derived.kx, derived.kz2.re, 0).normalize();
      this.kArrows.slab.position.copy(entry);
      this.kArrows.slab.setDirection(dSlab);
      if (this.kArrows.slab.visible) {
        this.kArrows.slab.setLength(slabLength, 0.1, 0.055);
      }
      exitX = Math.min(X_SPAN / 2 - 0.4, derived.rayExitOffsetM / lambda);
    }
    const transmits = derived.exitRegime === 'propagating' && dL < Z_MAX - 0.4;
    this.kArrows.transmitted.visible = transmits;
    if (transmits) {
      this.kArrows.transmitted.position.set(toSceneX(exitX), toSceneY(dL), 0.004);
      this.kArrows.transmitted.setDirection(new Vector3(derived.kx, derived.kz3.re, 0).normalize());
      this.kArrows.transmitted.setLength(0.45, 0.1, 0.055);
    }

    // <S> arrows from the model's observables on a coarse grid (time-independent),
    // plus a row at the slab mid-plane so the flux inside a thin slab is visible.
    const sValues: { x: number; y: number; sx: number; sz: number; mag: number }[] = [];
    let maxMag = 0;
    for (let iz = 0; iz < S_ROWS; iz++) {
      const inSlabRow = iz === S_ARROWS_Z;
      const zL = inSlabRow ? dL / 2 : Z_MIN + 0.3 + ((Z_MAX - Z_MIN - 0.6) * iz) / (S_ARROWS_Z - 1);
      for (let ix = 0; ix < S_ARROWS_X; ix++) {
        // The slab row is offset by half a column so its arrows don't line up with the grid's.
        const col = ix + (inSlabRow ? 0.5 : 0);
        const xL = -X_SPAN / 2 + 0.35 + ((X_SPAN - 0.7) * col) / (S_ARROWS_X - 1);
        if (inSlabRow && (dL < 0.04 || dL > Z_MAX)) {
          sValues.push({ x: 0, y: 0, sx: 0, sz: 0, mag: 0 });
          continue;
        }
        const point = { x: xL * lambda, y: 0, z: zL * lambda };
        const sObs = layeredSlabModel.observables(params, point).find((o) => o.id === 'S-avg');
        const S = sObs?.kind === 'vec3' ? sObs.value : { x: 0, y: 0, z: 0 };
        const mag = Math.hypot(S.x, S.z);
        maxMag = Math.max(maxMag, mag);
        sValues.push({ x: toSceneX(xL), y: toSceneY(zL), sx: S.x, sz: S.z, mag });
      }
    }
    sValues.forEach((v, i) => {
      const arrow = this.sArrows[i];
      if (!arrow) return;
      const visible = maxMag > 0 && v.mag > 0.02 * maxMag;
      arrow.visible = visible;
      if (!visible) return;
      arrow.position.x = v.x;
      arrow.position.y = v.y;
      arrow.setDirection(new Vector3(v.sx, v.sz, 0).normalize());
      const len = 0.05 + 0.13 * (v.mag / maxMag);
      arrow.setLength(len, 0.35 * len, 0.22 * len);
    });

    this.lastParams = params;
  }

  frame(dt: number): void {
    const state = useWaveLabStore.getState();
    if (state.playing) {
      useWaveLabStore.setState({ tau: state.tau + dt * state.speed });
    }
    const { layeredSlab, tau } = useWaveLabStore.getState();
    if (layeredSlab !== this.lastParams) this.recompute(layeredSlab);
    this.layer.update(2 * Math.PI * tau);
  }

  dispose(): void {
    this.layer.dispose();
  }
}
