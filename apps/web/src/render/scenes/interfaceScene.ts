import {
  ArrowHelper,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector3,
  type Camera,
  type WebGPURenderer,
} from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  cabs,
  derivePlanarInterface,
  interfaceFieldsAt,
  planarInterfaceModel,
  timeAveragedPoynting,
  type PlanarInterfaceState,
} from '@openem/physics-core';
import { useWaveLabStore } from '../../state/store';
import { HeatmapLayer } from '../heatmapLayer';
import { HeightFieldLayer } from '../heightFieldLayer';
import { smallViewport } from '../quality';
import type { SceneController } from '../../modules/types';

/** Physical domain in medium-1 wavelengths: x in [-2, 2], z in [-2.5, 1.5]. */
const X_SPAN = 4;
const Z_MIN = -2.5;
const Z_MAX = 1.5;
const QUAD = 2.4;
/** Scene units per medium-1 wavelength. */
const UNIT = QUAD / X_SPAN;
/** Interface (z = 0) height in scene units (quad centered at origin). */
const INTERFACE_Y = -Z_MIN * UNIT - QUAD / 2;

const S_ARROWS_X = 7;
const S_ARROWS_Z = 7;

const toSceneX = (xOverLambda: number): number => xOverLambda * UNIT;
const toSceneY = (zOverLambda: number): number => zOverLambda * UNIT + INTERFACE_Y;

/**
 * Total-field heatmap of the continuous scalar (Ey for TE, Hy for TM) across
 * both half-spaces - its visible smoothness at z = 0 IS the boundary
 * condition. k arrows show phase directions; S arrows are computed from
 * (1/2)Re{E x H*} on a coarse grid, never from k (under TIR they visibly run
 * along the interface). Fixed normalization E0(1+|r|) so TIR honestly decays.
 */
const HEIGHT_SCALE = 0.3;

export class InterfaceScene implements SceneController {
  readonly scene = new Scene();
  camera: Camera;

  private orthoCamera = new OrthographicCamera(-2, 2, 1.35, -1.35, 0.1, 10);
  private perspCamera = new PerspectiveCamera(50, 1.6, 0.01, 100);
  private controls: OrbitControls;
  /** 2D overlay group (heatmap quad, arrows, interface line, ring probe). */
  private group = new Group();
  private layer: HeatmapLayer;
  /** 3D surface view: local XY plane rotated flat, height along world y. */
  private surfaceGroup = new Group();
  private surface: HeightFieldLayer;
  private surfaceProbe: Mesh;
  private readonly surfaceGrid = smallViewport() ? 96 : 128;
  private surfaceScalarBuf: Float32Array;
  private surfacePointsBuf: Float32Array;
  private lastView3d: boolean | null = null;
  private probeMarker: Mesh;
  private kArrows: { incident: ArrowHelper; reflected: ArrowHelper; transmitted: ArrowHelper };
  private sArrows: ArrowHelper[] = [];
  private lastParams: PlanarInterfaceState | null = null;
  /** Quality tier chosen once at construction (docs/architecture.md). */
  private readonly grid = smallViewport() ? 160 : 224;
  private gridPointsBuf: Float32Array;
  private scalarBuf: Float32Array;
  private aspect = 1.6;

  constructor(_renderer: WebGPURenderer, canvas: HTMLCanvasElement) {
    this.orthoCamera.position.set(0, 0, 5);
    this.perspCamera.position.set(2.2, 1.8, 2.6);
    this.camera = this.orthoCamera;
    this.controls = new OrbitControls(this.perspCamera, canvas);
    this.controls.enabled = false;
    this.scene.add(this.group);

    // 3D surface of the continuous scalar; the smooth seam across the wall
    // IS the tangential boundary condition, visible from any angle.
    this.surfaceGroup.rotation.x = -Math.PI / 2;
    this.surfaceGroup.visible = false;
    this.scene.add(this.surfaceGroup);
    this.surface = new HeightFieldLayer(
      this.surfaceGroup,
      this.surfaceGrid,
      QUAD,
      QUAD,
      HEIGHT_SCALE,
    );
    this.surfaceScalarBuf = new Float32Array(2 * this.surfaceGrid * this.surfaceGrid);
    this.surfacePointsBuf = new Float32Array(3 * this.surfaceGrid * this.surfaceGrid);
    // Translucent vertical wall marking the medium boundary (z = 0 maps to
    // world z = -INTERFACE_Y after the flat rotation).
    const wall = new Mesh(
      new PlaneGeometry(QUAD, 2.8 * HEIGHT_SCALE),
      new MeshBasicMaterial({
        color: 0xe5e7eb,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        side: 2,
      }),
    );
    wall.position.set(0, 0, -INTERFACE_Y);
    wall.rotation.y = 0;
    this.scene.add(wall);
    this.surfaceWall = wall;
    this.surfaceProbe = new Mesh(
      new SphereGeometry(0.03, 16, 16),
      new MeshBasicMaterial({ color: 0xffffff }),
    );
    this.surfaceGroup.add(this.surfaceProbe);

    this.gridPointsBuf = new Float32Array(3 * this.grid * this.grid);
    this.scalarBuf = new Float32Array(2 * this.grid * this.grid);
    this.layer = new HeatmapLayer(this.group, this.grid, QUAD, QUAD);

    // Interface line at z = 0.
    const line = new Mesh(
      new PlaneGeometry(QUAD, 0.012),
      new MeshBasicMaterial({ color: 0xe5e7eb }),
    );
    line.position.set(0, INTERFACE_Y, 0.002);
    this.group.add(line);

    const mkArrow = (color: number): ArrowHelper => {
      const arrow = new ArrowHelper(new Vector3(0, 1, 0), new Vector3(), 0.5, color, 0.1, 0.055);
      arrow.position.z = 0.004;
      this.group.add(arrow);
      return arrow;
    };
    this.kArrows = {
      incident: mkArrow(0xf59e0b),
      reflected: mkArrow(0xf59e0b),
      transmitted: mkArrow(0xf59e0b),
    };

    for (let i = 0; i < S_ARROWS_X * S_ARROWS_Z; i++) {
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

    this.probeMarker = new Mesh(
      new RingGeometry(0.02, 0.032, 24),
      new MeshBasicMaterial({ color: 0xffffff }),
    );
    this.probeMarker.position.z = 0.005;
    this.group.add(this.probeMarker);

    // Grid points are fixed in wavelength units; physical coords set per params.
  }

  private surfaceWall: Mesh;

  resize(width: number, height: number): void {
    this.aspect = width / height;
    this.perspCamera.aspect = this.aspect;
    this.perspCamera.updateProjectionMatrix();
    const halfH = Math.max(1.35, 1.5 / this.aspect);
    const halfW = halfH * this.aspect;
    this.orthoCamera.left = -halfW;
    this.orthoCamera.right = halfW;
    this.orthoCamera.top = halfH;
    this.orthoCamera.bottom = -halfH;
    this.orthoCamera.updateProjectionMatrix();
  }

  private recompute(params: PlanarInterfaceState): void {
    const derived = derivePlanarInterface(params);
    const lambda = derived.wavelength1M;

    // Heatmap phasors: sample the full field grid once.
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
    const sample = planarInterfaceModel.sampleField(params, this.gridPointsBuf, 0);
    const source = params.polarization === 'TE' ? sample.Ephasor : sample.Hphasor;
    for (let i = 0; i < n * n; i++) {
      this.scalarBuf[2 * i] = source[6 * i + 2] ?? 0;
      this.scalarBuf[2 * i + 1] = source[6 * i + 3] ?? 0;
    }
    const incAmp = params.polarization === 'TE' ? params.E0 : params.E0 / derived.eta1;
    const norm = incAmp * (1 + cabs(derived.r));
    this.layer.setPhasors(this.scalarBuf, norm);
    this.surfaceNorm = norm;

    // Surface phasors at the height-field resolution.
    const m = this.surfaceGrid;
    for (let iz = 0; iz < m; iz++) {
      const z = (Z_MIN + ((Z_MAX - Z_MIN) * iz) / (m - 1)) * lambda;
      for (let ix = 0; ix < m; ix++) {
        const i = iz * m + ix;
        this.surfacePointsBuf[3 * i] = (-X_SPAN / 2 + (X_SPAN * ix) / (m - 1)) * lambda;
        this.surfacePointsBuf[3 * i + 1] = 0;
        this.surfacePointsBuf[3 * i + 2] = z;
      }
    }
    const surfaceSample = planarInterfaceModel.sampleField(params, this.surfacePointsBuf, 0);
    const surfaceSource =
      params.polarization === 'TE' ? surfaceSample.Ephasor : surfaceSample.Hphasor;
    for (let i = 0; i < m * m; i++) {
      this.surfaceScalarBuf[2 * i] = surfaceSource[6 * i + 2] ?? 0;
      this.surfaceScalarBuf[2 * i + 1] = surfaceSource[6 * i + 3] ?? 0;
    }
    this.surface.setPhasors(this.surfaceScalarBuf, norm);

    // k arrows: incident and reflected in medium 1; transmitted only when the
    // wave actually propagates (phase direction from Re kz2).
    const theta = (params.thetaDeg * Math.PI) / 180;
    const hit = new Vector3(0, INTERFACE_Y, 0.004);
    const dIn = new Vector3(Math.sin(theta), Math.cos(theta), 0);
    this.kArrows.incident.position.copy(hit.clone().addScaledVector(dIn, -0.62));
    this.kArrows.incident.setDirection(dIn);
    this.kArrows.incident.setLength(0.5, 0.1, 0.055);
    const dRef = new Vector3(Math.sin(theta), -Math.cos(theta), 0);
    this.kArrows.reflected.position.copy(hit);
    this.kArrows.reflected.setDirection(dRef);
    this.kArrows.reflected.setLength(0.5, 0.1, 0.055);
    const transmits = derived.regime === 'propagating' || derived.regime === 'lossy';
    this.kArrows.transmitted.visible = transmits;
    if (transmits) {
      const dTr = new Vector3(derived.kx, derived.kz2.re, 0).normalize();
      this.kArrows.transmitted.position.copy(hit);
      this.kArrows.transmitted.setDirection(dTr);
      this.kArrows.transmitted.setLength(0.5, 0.1, 0.055);
    }

    // <S> arrows from the fields on a coarse grid (time-independent).
    const sValues: { x: number; y: number; sx: number; sz: number; mag: number }[] = [];
    let maxMag = 0;
    for (let iz = 0; iz < S_ARROWS_Z; iz++) {
      const zL = Z_MIN + 0.35 + ((Z_MAX - Z_MIN - 0.7) * iz) / (S_ARROWS_Z - 1);
      for (let ix = 0; ix < S_ARROWS_X; ix++) {
        const xL = -X_SPAN / 2 + 0.35 + ((X_SPAN - 0.7) * ix) / (S_ARROWS_X - 1);
        const f = interfaceFieldsAt(params, derived, xL * lambda, zL * lambda, 0);
        const S = timeAveragedPoynting(f.Ephasor, f.Hphasor);
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

  private surfaceNorm = 1;

  frame(dt: number): void {
    const state = useWaveLabStore.getState();
    if (state.playing) {
      useWaveLabStore.setState({ tau: state.tau + dt * state.speed });
    }
    const { planarInterface, tau, probeX, probeZ, interfaceView3d } = useWaveLabStore.getState();
    if (planarInterface !== this.lastParams) this.recompute(planarInterface);

    if (interfaceView3d !== this.lastView3d) {
      this.group.visible = !interfaceView3d;
      this.surfaceGroup.visible = interfaceView3d;
      this.surfaceWall.visible = interfaceView3d;
      this.camera = interfaceView3d ? this.perspCamera : this.orthoCamera;
      this.controls.enabled = interfaceView3d;
      this.lastView3d = interfaceView3d;
    }

    const omegaT = 2 * Math.PI * tau;
    if (interfaceView3d) {
      this.surface.update(omegaT);
      // Probe sphere rides the oscillating surface.
      const derived = derivePlanarInterface(planarInterface);
      const f = interfaceFieldsAt(
        planarInterface,
        derived,
        probeX * derived.wavelength1M,
        probeZ * derived.wavelength1M,
        0,
      );
      const scalar = planarInterface.polarization === 'TE' ? f.Ephasor.y : f.Hphasor.y;
      const value = scalar.re * Math.cos(omegaT) + scalar.im * Math.sin(omegaT);
      const displacement = Math.max(
        -1.25 * HEIGHT_SCALE,
        Math.min(1.25 * HEIGHT_SCALE, (value / this.surfaceNorm) * HEIGHT_SCALE),
      );
      this.surfaceProbe.position.set(toSceneX(probeX), toSceneY(probeZ), displacement + 0.02);
      this.controls.update();
    } else {
      this.probeMarker.position.x = toSceneX(probeX);
      this.probeMarker.position.y = toSceneY(probeZ);
      this.layer.update(omegaT);
    }
  }

  dispose(): void {
    this.controls.dispose();
    this.layer.dispose();
    this.surface.dispose();
  }
}
