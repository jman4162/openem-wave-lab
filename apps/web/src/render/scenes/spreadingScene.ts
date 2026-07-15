import {
  CircleGeometry,
  CylinderGeometry,
  GridHelper,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  SphereGeometry,
  type Camera,
  type WebGPURenderer,
} from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  cabs,
  deriveSpreading,
  spreadingFieldsAt,
  spreadingModel,
  type SpreadingSample,
  type SpreadingState,
} from '@openem/physics-core';
import { useWaveLabStore, type SpreadingViewKind } from '../../state/store';
import { HeatmapLayer } from '../heatmapLayer';
import { HeightFieldLayer } from '../heightFieldLayer';
import { smallViewport } from '../quality';
import type { SceneController } from '../../modules/types';

/** Physical domain shown: [-4λ, 4λ] in both axes. */
const DOMAIN_WAVELENGTHS = 8;

const SINGLE_SIZE = 2.4;
const COMPARE_SIZE = 1.1;
const COMPARE_GAP = 0.12;
const HEIGHT_SCALE = 0.3;

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
 * Spreading-field views: 2D heatmaps (single quad or comparison triptych) or
 * an orbitable 3D height-field surface of the selected wave kind, all sharing
 * one time base and one normalization (amplitude A at the LUT extremes).
 */
export class SpreadingScene implements SceneController {
  readonly scene = new Scene();
  camera: Camera;

  private orthoCamera = new OrthographicCamera(-2, 2, 1.2, -1.2, 0.1, 10);
  private perspCamera = new PerspectiveCamera(50, 1.6, 0.01, 100);
  private controls: OrbitControls;

  private single: QuadGroup;
  private compare: QuadGroup[];
  /** 3D surface view: mesh lies in the xz-plane, height along world y. */
  private surfaceGroup = new Group();
  private surface: HeightFieldLayer;
  private surfaceProbe: Mesh;

  /** Quality tier chosen once at construction (docs/architecture.md). */
  private readonly singleGrid = smallViewport() ? 160 : 256;
  private readonly compareGrid = smallViewport() ? 128 : 176;
  private readonly surfaceGrid = smallViewport() ? 96 : 128;

  private lastParams: SpreadingState | null = null;
  private lastKind: SpreadingViewKind | null = null;
  private lastCompare: boolean | null = null;
  private lastEnvelope: boolean | null = null;
  private lastView3d: boolean | null = null;
  private aspect = 1.6;

  constructor(_renderer: WebGPURenderer, canvas: HTMLCanvasElement) {
    this.orthoCamera.position.set(0, 0, 5);
    this.perspCamera.position.set(2.4, 1.9, 2.4);
    this.camera = this.orthoCamera;
    this.controls = new OrbitControls(this.perspCamera, canvas);
    this.controls.enabled = false;

    this.single = this.makeQuad(this.singleGrid, SINGLE_SIZE, 'cylindrical', 0);
    this.compare = KINDS.map((kind, i) =>
      this.makeQuad(this.compareGrid, COMPARE_SIZE, kind, (i - 1) * (COMPARE_SIZE + COMPARE_GAP)),
    );

    // 3D surface: plane rotated to lie flat (local z -> world y).
    this.surfaceGroup.rotation.x = -Math.PI / 2;
    this.surfaceGroup.visible = false;
    this.scene.add(this.surfaceGroup);
    this.surface = new HeightFieldLayer(
      this.surfaceGroup,
      this.surfaceGrid,
      SINGLE_SIZE,
      SINGLE_SIZE,
      HEIGHT_SCALE,
    );
    // Excluded source region as a vertical plug the surface passes under.
    const plugRadius = (0.25 / DOMAIN_WAVELENGTHS) * SINGLE_SIZE;
    const plug = new Mesh(
      new CylinderGeometry(plugRadius, plugRadius, 2.6 * HEIGHT_SCALE, 24),
      new MeshBasicMaterial({ color: 0x101014 }),
    );
    plug.rotation.x = Math.PI / 2; // axis along local z = world up
    this.surfaceGroup.add(plug);

    this.surfaceProbe = new Mesh(
      new SphereGeometry(0.03, 16, 16),
      new MeshBasicMaterial({ color: 0xffffff }),
    );
    this.surfaceGroup.add(this.surfaceProbe);

    const grid = new GridHelper(4, 16, 0x333333, 0x222222);
    grid.position.y = -1.3 * HEIGHT_SCALE;
    grid.visible = false;
    this.scene.add(grid);
    this.surfaceFloor = grid;
  }

  private surfaceFloor: GridHelper;

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
    this.perspCamera.aspect = this.aspect;
    this.perspCamera.updateProjectionMatrix();
    this.updateFrustum();
  }

  private updateFrustum(): void {
    const compare = useWaveLabStore.getState().spreadingCompare;
    const contentHalfW = compare ? 1.5 * COMPARE_SIZE + COMPARE_GAP + 0.15 : SINGLE_SIZE / 2 + 0.15;
    const contentHalfH = (compare ? COMPARE_SIZE : SINGLE_SIZE) / 2 + 0.15;
    const halfH = Math.max(contentHalfH, contentHalfW / this.aspect);
    const halfW = halfH * this.aspect;
    this.orthoCamera.left = -halfW;
    this.orthoCamera.right = halfW;
    this.orthoCamera.top = halfH;
    this.orthoCamera.bottom = -halfH;
    this.orthoCamera.updateProjectionMatrix();
  }

  frame(dt: number): void {
    const state = useWaveLabStore.getState();
    if (state.playing) {
      useWaveLabStore.setState({ tau: state.tau + dt * state.speed });
    }
    const {
      spreading,
      tau,
      probeRho,
      spreadingKind,
      spreadingCompare,
      spreadingEnvelope,
      spreadingView3d,
    } = useWaveLabStore.getState();

    const viewChanged =
      spreadingCompare !== this.lastCompare ||
      spreadingKind !== this.lastKind ||
      spreadingView3d !== this.lastView3d;
    const paramsChanged = spreading !== this.lastParams;
    const modeChanged = spreadingEnvelope !== this.lastEnvelope;

    if (viewChanged) {
      this.single.group.visible = !spreadingCompare && !spreadingView3d;
      for (const q of this.compare) q.group.visible = spreadingCompare;
      this.surfaceGroup.visible = spreadingView3d;
      this.surfaceFloor.visible = spreadingView3d;
      this.single.kind = spreadingKind;
      this.camera = spreadingView3d ? this.perspCamera : this.orthoCamera;
      this.controls.enabled = spreadingView3d;
      this.updateFrustum();
    }

    if (paramsChanged || viewChanged) {
      const derived = deriveSpreading(spreading);
      const spanM = DOMAIN_WAVELENGTHS * derived.wavelengthM;
      const norm = spreading.amplitude;
      if (spreadingCompare) {
        const sample = spreadingModel.sampleField(
          spreading,
          gridPoints(this.compareGrid, spanM),
          0,
        );
        for (const q of this.compare) q.layer.setPhasors(sampleFor(sample, q.kind), norm);
      } else if (spreadingView3d) {
        const sample = spreadingModel.sampleField(
          spreading,
          gridPoints(this.surfaceGrid, spanM),
          0,
        );
        this.surface.setPhasors(sampleFor(sample, spreadingKind), norm);
      } else {
        const sample = spreadingModel.sampleField(spreading, gridPoints(this.singleGrid, spanM), 0);
        this.single.layer.setPhasors(sampleFor(sample, this.single.kind), norm);
      }
      this.lastParams = spreading;
      this.lastKind = spreadingKind;
      this.lastCompare = spreadingCompare;
      this.lastView3d = spreadingView3d;
    }

    if (modeChanged) {
      const mode = spreadingEnvelope ? 'envelope' : 'instantaneous';
      this.single.layer.setMode(mode);
      for (const q of this.compare) q.layer.setMode(mode);
      this.surface.setMode(mode);
      this.lastEnvelope = spreadingEnvelope;
    }

    const omegaT = 2 * Math.PI * tau;
    if (spreadingView3d) {
      this.surface.update(omegaT);
      // Probe sphere rides the oscillating surface.
      const derived = deriveSpreading(spreading);
      const f = spreadingFieldsAt(
        spreading,
        derived,
        probeRho * derived.wavelengthM,
        0,
        // time handled via phasor rotation below
      );
      const psi =
        spreadingKind === 'plane'
          ? f.psiPlane
          : spreadingKind === 'cylindrical'
            ? f.psiCylindrical
            : f.psiSpherical;
      const value = spreadingEnvelope
        ? cabs(psi)
        : psi.re * Math.cos(omegaT) + psi.im * Math.sin(omegaT);
      const displacement = Math.max(
        -1.25 * HEIGHT_SCALE,
        Math.min(1.25 * HEIGHT_SCALE, (value / spreading.amplitude) * HEIGHT_SCALE),
      );
      const probeSceneX = (probeRho / DOMAIN_WAVELENGTHS) * SINGLE_SIZE;
      this.surfaceProbe.position.set(probeSceneX, 0, displacement + 0.02);
      this.controls.update();
    } else {
      const probeSceneX =
        (probeRho / DOMAIN_WAVELENGTHS) * (spreadingCompare ? COMPARE_SIZE : SINGLE_SIZE);
      for (const q of spreadingCompare ? this.compare : [this.single]) {
        q.probe.position.x = probeSceneX;
        q.disk.visible = q.kind !== 'plane';
      }
      if (spreadingCompare) {
        for (const q of this.compare) q.layer.update(omegaT);
      } else {
        this.single.layer.update(omegaT);
      }
    }
  }

  dispose(): void {
    this.controls.dispose();
    this.single.layer.dispose();
    for (const q of this.compare) q.layer.dispose();
    this.surface.dispose();
  }
}
