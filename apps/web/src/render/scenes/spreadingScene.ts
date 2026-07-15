import {
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  RingGeometry,
  Scene,
  type WebGPURenderer,
} from 'three/webgpu';
import {
  deriveSpreading,
  spreadingModel,
  type SpreadingSample,
  type SpreadingState,
} from '@openem/physics-core';
import { useWaveLabStore, type SpreadingViewKind } from '../../state/store';
import { HeatmapLayer } from '../heatmapLayer';
import type { SceneController } from '../../modules/types';

/** Physical domain shown: [-4λ, 4λ] in both axes. */
const DOMAIN_WAVELENGTHS = 8;
const SINGLE_GRID = 256;
const COMPARE_GRID = 176;
const SINGLE_SIZE = 2.4;
const COMPARE_SIZE = 1.1;
const COMPARE_GAP = 0.12;

const KINDS: SpreadingViewKind[] = ['plane', 'cylindrical', 'spherical'];

const sampleFor = (sample: SpreadingSample, kind: SpreadingViewKind): Float32Array =>
  kind === 'plane'
    ? sample.psiPlane
    : kind === 'cylindrical'
      ? sample.psiCylindrical
      : sample.psiSpherical;

/** Grid points in physical meters, xyz-interleaved, row-major from bottom. */
function gridPoints(n: number, spanM: number): Float32Array {
  const points = new Float32Array(3 * n * n);
  for (let iz = 0; iz < n; iz++) {
    const z = (iz / (n - 1) - 0.5) * spanM;
    for (let ix = 0; ix < n; ix++) {
      const i = iz * n + ix;
      points[3 * i] = (ix / (n - 1) - 0.5) * spanM;
      points[3 * i + 1] = 0;
      points[3 * i + 2] = z;
    }
  }
  return points;
}

interface QuadGroup {
  group: Group;
  layer: HeatmapLayer;
  disk: Mesh;
  probe: Mesh;
  kind: SpreadingViewKind;
  quadSize: number;
}

/**
 * 2D cross-section heatmaps of the spreading fields: one large quad or a
 * plane/cylindrical/spherical comparison triptych sharing one time base and
 * one colormap normalization (amplitude A at the LUT extremes).
 */
export class SpreadingScene implements SceneController {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-2, 2, 1.2, -1.2, 0.1, 10);

  private single: QuadGroup;
  private compare: QuadGroup[];
  private lastParams: SpreadingState | null = null;
  private lastKind: SpreadingViewKind | null = null;
  private lastCompare: boolean | null = null;
  private lastEnvelope: boolean | null = null;
  private aspect = 1.6;

  constructor(_renderer: WebGPURenderer, _canvas: HTMLCanvasElement) {
    this.camera.position.set(0, 0, 5);

    this.single = this.makeQuad(SINGLE_GRID, SINGLE_SIZE, 'cylindrical', 0);
    this.compare = KINDS.map((kind, i) =>
      this.makeQuad(COMPARE_GRID, COMPARE_SIZE, kind, (i - 1) * (COMPARE_SIZE + COMPARE_GAP)),
    );
  }

  private makeQuad(
    gridN: number,
    quadSize: number,
    kind: SpreadingViewKind,
    xOffset: number,
  ): QuadGroup {
    const group = new Group();
    group.position.x = xOffset;
    this.scene.add(group);

    const layer = new HeatmapLayer(group, gridN, quadSize, quadSize);

    // Excluded source region: the point/line-source expressions are singular
    // at r = 0 (spec 6.2 safeguard); physics-core zeroes the field inside.
    const diskRadius = (0.25 / DOMAIN_WAVELENGTHS) * quadSize;
    const disk = new Mesh(
      new CircleGeometry(diskRadius, 32),
      new MeshBasicMaterial({ color: 0x101014 }),
    );
    disk.position.z = 0.001;
    group.add(disk);

    const probe = new Mesh(
      new RingGeometry(0.018, 0.028, 24),
      new MeshBasicMaterial({ color: 0xffffff }),
    );
    probe.position.z = 0.002;
    group.add(probe);

    return { group, layer, disk, probe, kind, quadSize };
  }

  resize(width: number, height: number): void {
    this.aspect = width / height;
    this.updateFrustum();
  }

  private updateFrustum(): void {
    const compare = useWaveLabStore.getState().spreadingCompare;
    const contentHalfW = compare ? 1.5 * COMPARE_SIZE + COMPARE_GAP + 0.15 : SINGLE_SIZE / 2 + 0.15;
    const contentHalfH = (compare ? COMPARE_SIZE : SINGLE_SIZE) / 2 + 0.15;
    const halfH = Math.max(contentHalfH, contentHalfW / this.aspect);
    const halfW = halfH * this.aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  frame(dt: number): void {
    const state = useWaveLabStore.getState();
    if (state.playing) {
      useWaveLabStore.setState({ tau: state.tau + dt * state.speed });
    }
    const { spreading, tau, probeRho, spreadingKind, spreadingCompare, spreadingEnvelope } =
      useWaveLabStore.getState();

    const viewChanged = spreadingCompare !== this.lastCompare || spreadingKind !== this.lastKind;
    const paramsChanged = spreading !== this.lastParams;
    const modeChanged = spreadingEnvelope !== this.lastEnvelope;

    if (viewChanged) {
      this.single.group.visible = !spreadingCompare;
      for (const q of this.compare) q.group.visible = spreadingCompare;
      this.single.kind = spreadingKind;
      this.updateFrustum();
    }

    if (paramsChanged || viewChanged) {
      const derived = deriveSpreading(spreading);
      const spanM = DOMAIN_WAVELENGTHS * derived.wavelengthM;
      const norm = spreading.amplitude;
      if (spreadingCompare) {
        const sample = spreadingModel.sampleField(spreading, gridPoints(COMPARE_GRID, spanM), 0);
        for (const q of this.compare) q.layer.setPhasors(sampleFor(sample, q.kind), norm);
      } else {
        const sample = spreadingModel.sampleField(spreading, gridPoints(SINGLE_GRID, spanM), 0);
        this.single.layer.setPhasors(sampleFor(sample, this.single.kind), norm);
      }
      this.lastParams = spreading;
      this.lastKind = spreadingKind;
      this.lastCompare = spreadingCompare;
    }

    if (modeChanged) {
      const mode = spreadingEnvelope ? 'envelope' : 'instantaneous';
      this.single.layer.setMode(mode);
      for (const q of this.compare) q.layer.setMode(mode);
      this.lastEnvelope = spreadingEnvelope;
    }

    // Probe and excluded-disk overlays track the current view.
    const probeSceneX =
      (probeRho / DOMAIN_WAVELENGTHS) * (spreadingCompare ? COMPARE_SIZE : SINGLE_SIZE);
    for (const q of spreadingCompare ? this.compare : [this.single]) {
      q.probe.position.x = probeSceneX;
      q.disk.visible = q.kind !== 'plane';
    }

    const omegaT = 2 * Math.PI * tau;
    if (spreadingCompare) {
      for (const q of this.compare) q.layer.update(omegaT);
    } else {
      this.single.layer.update(omegaT);
    }
  }

  dispose(): void {
    this.single.layer.dispose();
    for (const q of this.compare) q.layer.dispose();
  }
}
