import {
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
  type Group,
} from 'three/webgpu';

const UP = new Vector3(0, 1, 0);

/**
 * A set of N arrows rendered as two instanced meshes (shaft + head).
 * update() re-poses every instance from base positions and vectors.
 */
export class ArrowField {
  private shafts: InstancedMesh;
  private heads: InstancedMesh;
  private dummy = new Object3D();
  private quat = new Quaternion();
  private dir = new Vector3();
  private matrix = new Matrix4();

  constructor(parent: Group, count: number, color: number) {
    const material = new MeshBasicMaterial({ color });
    // Shaft: unit height along +y with base at the origin.
    const shaftGeo = new CylinderGeometry(0.006, 0.006, 1, 6);
    shaftGeo.translate(0, 0.5, 0);
    // Head: cone sitting on top of a unit shaft.
    const headGeo = new ConeGeometry(0.02, 0.06, 10);
    headGeo.translate(0, 0.03, 0);

    this.shafts = new InstancedMesh(shaftGeo, material, count);
    this.heads = new InstancedMesh(headGeo, material, count);
    parent.add(this.shafts);
    parent.add(this.heads);
  }

  /**
   * positions: xyz-interleaved arrow bases (scene units).
   * vectors: xyz-interleaved arrow displacements (scene units).
   */
  update(positions: Float32Array, vectors: Float32Array): void {
    const count = Math.min(this.shafts.count, Math.floor(positions.length / 3));
    for (let i = 0; i < count; i++) {
      const px = positions[3 * i] ?? 0;
      const py = positions[3 * i + 1] ?? 0;
      const pz = positions[3 * i + 2] ?? 0;
      this.dir.set(vectors[3 * i] ?? 0, vectors[3 * i + 1] ?? 0, vectors[3 * i + 2] ?? 0);
      const len = this.dir.length();

      if (len < 1e-6) {
        // Collapse invisible arrows instead of leaving stale poses.
        this.matrix.makeScale(0, 0, 0);
        this.shafts.setMatrixAt(i, this.matrix);
        this.heads.setMatrixAt(i, this.matrix);
        continue;
      }

      this.dir.multiplyScalar(1 / len);
      this.quat.setFromUnitVectors(UP, this.dir);

      this.dummy.position.set(px, py, pz);
      this.dummy.quaternion.copy(this.quat);
      this.dummy.scale.set(1, len, 1);
      this.dummy.updateMatrix();
      this.shafts.setMatrixAt(i, this.dummy.matrix);

      // Head at the arrow tip, unit scale so it doesn't stretch.
      this.dummy.position.set(px + this.dir.x * len, py + this.dir.y * len, pz + this.dir.z * len);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.heads.setMatrixAt(i, this.dummy.matrix);
    }
    this.shafts.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
  }
}
