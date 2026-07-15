import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Sphere,
  SphereGeometry,
  Vector3,
  type Object3D,
} from 'three/webgpu';

/**
 * A dynamic 1D curve for wave plots: N points updated per frame via
 * setPositions. Shared by the velocity and standing-wave scenes.
 */
export class WaveCurve {
  readonly line: Line;
  private positions: BufferAttribute;
  private readonly n: number;

  constructor(parent: Object3D, n: number, color: number, bound = 4) {
    this.n = n;
    const geometry = new BufferGeometry();
    this.positions = new BufferAttribute(new Float32Array(3 * n), 3);
    this.positions.setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', this.positions);
    geometry.boundingSphere = new Sphere(new Vector3(), bound);
    this.line = new Line(geometry, new LineBasicMaterial({ color }));
    parent.add(this.line);
  }

  get count(): number {
    return this.n;
  }

  /** Write scene-space points; xs/ys length must be >= n. */
  setPositions(xs: Float32Array, ys: Float32Array): void {
    const arr = this.positions.array as Float32Array;
    for (let i = 0; i < this.n; i++) {
      arr[3 * i] = xs[i] ?? 0;
      arr[3 * i + 1] = ys[i] ?? 0;
      arr[3 * i + 2] = 0;
    }
    this.positions.needsUpdate = true;
  }

  dispose(): void {
    this.line.geometry.dispose();
    (this.line.material as LineBasicMaterial).dispose();
  }
}

/** Small solid marker sphere for riding points (crest, envelope peak, probe). */
export function makeMarker(parent: Object3D, color: number, radius = 0.045): Mesh {
  const marker = new Mesh(new SphereGeometry(radius, 16, 16), new MeshBasicMaterial({ color }));
  parent.add(marker);
  return marker;
}
