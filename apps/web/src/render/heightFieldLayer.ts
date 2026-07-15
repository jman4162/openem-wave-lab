import {
  BufferAttribute,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Sphere,
  Vector3,
  type Object3D,
} from 'three/webgpu';
import { DIVERGING_LUT, SEQUENTIAL_LUT } from './colormap';
import type { HeatmapMode } from './heatmapLayer';

/**
 * 3D sibling of HeatmapLayer: the same cached phasor grid displaces mesh
 * vertices (z = Re{psi e^{-i omega t}} * scale) and colors them through the
 * same LUTs, so height and color redundantly encode the field. Unlit vertex
 * colors - no per-frame normals, no lighting, identical on both backends.
 * The mesh lies in its local XY plane with displacement along local z;
 * callers orient it (e.g. rotate the parent group so z points up).
 */
export class HeightFieldLayer {
  readonly mesh: Mesh;
  /** re/im interleaved, matching the physics-core sample layout. */
  private phasor: Float32Array;
  private positions: BufferAttribute;
  private colors: BufferAttribute;
  private norm = 1;
  private mode: HeatmapMode = 'instantaneous';
  private readonly n: number;
  private readonly heightScale: number;
  /** Displacement clamp so near-source spikes stay readable. */
  private readonly maxDisplacement: number;

  constructor(parent: Object3D, gridN: number, width: number, height: number, heightScale = 0.3) {
    this.n = gridN;
    this.heightScale = heightScale;
    this.maxDisplacement = 1.25 * heightScale;
    this.phasor = new Float32Array(2 * gridN * gridN);

    const geometry = new PlaneGeometry(width, height, gridN - 1, gridN - 1);
    this.positions = geometry.getAttribute('position') as BufferAttribute;
    this.positions.setUsage(DynamicDrawUsage);
    const colorArray = new Float32Array(3 * gridN * gridN);
    this.colors = new BufferAttribute(colorArray, 3);
    this.colors.setUsage(DynamicDrawUsage);
    geometry.setAttribute('color', this.colors);
    // Fixed generous bound instead of per-frame recomputation.
    geometry.boundingSphere = new Sphere(
      new Vector3(0, 0, 0),
      Math.hypot(width, height) / 2 + this.maxDisplacement,
    );

    this.mesh = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }));
    parent.add(this.mesh);
  }

  get gridN(): number {
    return this.n;
  }

  /** Cache the spatial phasor (re/im interleaved, 2N for N = gridN²), row 0 = bottom. */
  setPhasors(interleaved: Float32Array, norm: number): void {
    this.phasor.set(interleaved);
    this.norm = norm > 0 ? norm : 1;
  }

  setMode(mode: HeatmapMode): void {
    this.mode = mode;
  }

  /** Displace and recolor every vertex at phase omega*t. */
  update(omegaT: number): void {
    const { phasor, n, norm, heightScale, maxDisplacement } = this;
    const pos = this.positions.array as Float32Array;
    const col = this.colors.array as Float32Array;
    const envelope = this.mode === 'envelope';
    const c = Math.cos(omegaT);
    const s = Math.sin(omegaT);
    const lut = envelope ? SEQUENTIAL_LUT : DIVERGING_LUT;

    // PlaneGeometry rows run top-to-bottom; the phasor grid runs bottom-to-top
    // (DataTexture convention shared with HeatmapLayer), so flip rows.
    for (let iy = 0; iy < n; iy++) {
      const pRow = (n - 1 - iy) * n;
      const vRow = iy * n;
      for (let ix = 0; ix < n; ix++) {
        const pi = pRow + ix;
        const vi = vRow + ix;
        const re = phasor[2 * pi] ?? 0;
        const im = phasor[2 * pi + 1] ?? 0;
        const value = envelope ? Math.hypot(re, im) : re * c + im * s;
        const z = Math.max(
          -maxDisplacement,
          Math.min(maxDisplacement, (value / norm) * heightScale),
        );
        pos[3 * vi + 2] = z;
        const idx = envelope
          ? Math.max(0, Math.min(255, Math.round((value / norm) * 255)))
          : Math.max(0, Math.min(255, Math.round((value / norm) * 127.5 + 127.5)));
        col[3 * vi] = (lut[4 * idx] ?? 0) / 255;
        col[3 * vi + 1] = (lut[4 * idx + 1] ?? 0) / 255;
        col[3 * vi + 2] = (lut[4 * idx + 2] ?? 0) / 255;
      }
    }
    this.positions.needsUpdate = true;
    this.colors.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
  }
}
