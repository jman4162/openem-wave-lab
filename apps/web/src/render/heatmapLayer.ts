import {
  DataTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  type Object3D,
} from 'three/webgpu';
import { DIVERGING_LUT, SEQUENTIAL_LUT } from './colormap';

export type HeatmapMode = 'instantaneous' | 'envelope';

/**
 * A quad displaying a time-harmonic complex scalar field. The expensive
 * spatial evaluation happens once per parameter change (setPhasors); each
 * frame only rotates the cached phasor by e^{-i omega t} and maps through a
 * colormap LUT into the texture (2 mul + 1 add + lookup per texel).
 */
export class HeatmapLayer {
  readonly mesh: Mesh;
  private texture: DataTexture;
  private rgba: Uint8Array;
  /** re/im interleaved, matching the physics-core sample layout. */
  private phasor: Float32Array;
  private norm = 1;
  private mode: HeatmapMode = 'instantaneous';
  private readonly n: number;

  constructor(parent: Object3D, gridN: number, width: number, height: number) {
    this.n = gridN;
    this.phasor = new Float32Array(2 * gridN * gridN);
    this.rgba = new Uint8Array(gridN * gridN * 4);
    this.texture = new DataTexture(this.rgba, gridN, gridN, RGBAFormat, UnsignedByteType);
    this.texture.colorSpace = SRGBColorSpace;
    this.mesh = new Mesh(
      new PlaneGeometry(width, height),
      new MeshBasicMaterial({ map: this.texture }),
    );
    parent.add(this.mesh);
  }

  get gridN(): number {
    return this.n;
  }

  /**
   * Cache the spatial phasor (re/im interleaved, 2N values for N = gridN²);
   * norm is the |value| mapped to the LUT extremes.
   */
  setPhasors(interleaved: Float32Array, norm: number): void {
    this.phasor.set(interleaved);
    this.norm = norm > 0 ? norm : 1;
  }

  setMode(mode: HeatmapMode): void {
    this.mode = mode;
  }

  /** Re-map the cached phasor at phase omega*t into the texture. */
  update(omegaT: number): void {
    const { phasor, rgba, norm } = this;
    const count = this.n * this.n;
    if (this.mode === 'instantaneous') {
      const c = Math.cos(omegaT);
      const s = Math.sin(omegaT);
      const scale = 127.5 / norm;
      for (let i = 0; i < count; i++) {
        // Re{psi e^{-i omega t}} = re*cos + im*sin
        const value = ((phasor[2 * i] ?? 0) * c + (phasor[2 * i + 1] ?? 0) * s) * scale;
        const idx = Math.max(0, Math.min(255, Math.round(value + 127.5))) * 4;
        const o = i * 4;
        rgba[o] = DIVERGING_LUT[idx] ?? 0;
        rgba[o + 1] = DIVERGING_LUT[idx + 1] ?? 0;
        rgba[o + 2] = DIVERGING_LUT[idx + 2] ?? 0;
        rgba[o + 3] = 255;
      }
    } else {
      const scale = 255 / norm;
      for (let i = 0; i < count; i++) {
        const value = Math.hypot(phasor[2 * i] ?? 0, phasor[2 * i + 1] ?? 0) * scale;
        const idx = Math.max(0, Math.min(255, Math.round(value))) * 4;
        const o = i * 4;
        rgba[o] = SEQUENTIAL_LUT[idx] ?? 0;
        rgba[o + 1] = SEQUENTIAL_LUT[idx + 1] ?? 0;
        rgba[o + 2] = SEQUENTIAL_LUT[idx + 2] ?? 0;
        rgba[o + 3] = 255;
      }
    }
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
  }
}
