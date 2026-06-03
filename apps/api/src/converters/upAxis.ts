import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

/**
 * Re-author a (Y-up) GLB as Z-up by wrapping each scene's roots under a pivot
 * rotated +90° about X. glTF is Y-up by spec, so this is only applied when the
 * user explicitly requests a Z-up GLB.
 */
export async function makeGlbZUp(path: string): Promise<void> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(path);
  // Quaternion for +90° rotation about X: (sin45, 0, 0, cos45).
  const quat: [number, number, number, number] = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];

  for (const scene of doc.getRoot().listScenes()) {
    const pivot = doc.createNode('UpAxisPivot').setRotation(quat);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      pivot.addChild(child);
    }
    scene.addChild(pivot);
  }
  await io.write(path, doc);
}
