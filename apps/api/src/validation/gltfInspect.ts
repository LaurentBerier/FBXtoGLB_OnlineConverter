import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { AssetSummary, emptySummary } from './summary.js';

// Register the Draco decoder so we can also read Draco-compressed GLBs
// (e.g. our own optimized output) when building the validation report.
let ioPromise: Promise<NodeIO> | null = null;
function getIO(): Promise<NodeIO> {
  if (!ioPromise) {
    ioPromise = draco3d.createDecoderModule().then((decoder) =>
      new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
        'draco3d.decoder': decoder,
      }),
    );
  }
  return ioPromise;
}

/**
 * Inspect a .glb / .gltf file and produce a normalised AssetSummary.
 * Reads geometry, skins, animations, materials and textures from the document.
 */
export async function inspectGlb(filePath: string): Promise<AssetSummary> {
  const summary = emptySummary();
  summary.upAxis = 'y'; // glTF/GLB is Y-up by specification.
  const io = await getIO();
  const doc = await io.read(filePath);
  const root = doc.getRoot();

  const meshes = root.listMeshes();
  summary.meshes = meshes.length;

  // Nodes / names
  summary.nodeNames = root
    .listNodes()
    .map((n) => n.getName())
    .filter(Boolean);

  // Skins -> bones (unique joint nodes)
  const skins = root.listSkins();
  summary.hasSkin = skins.length > 0;
  const jointSet = new Map<string, true>();
  const jointNames: string[] = [];
  for (const skin of skins) {
    for (const joint of skin.listJoints()) {
      const key = joint.getName() || `joint_${jointNames.length}`;
      if (!jointSet.has(key)) {
        jointSet.set(key, true);
        jointNames.push(joint.getName());
      }
    }
  }
  summary.bones = jointNames.length;
  summary.boneNames = jointNames.filter(Boolean);

  // Skin weights: any primitive carrying JOINTS_0 + WEIGHTS_0
  let hasWeights = false;
  for (const mesh of meshes) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getAttribute('JOINTS_0') && prim.getAttribute('WEIGHTS_0')) {
        hasWeights = true;
        break;
      }
    }
    if (hasWeights) break;
  }
  summary.hasSkinWeights = hasWeights;

  // Animations
  const anims = root.listAnimations();
  summary.animations = anims.length;
  summary.animationNames = anims.map((a, i) => a.getName() || `clip_${i}`);
  let keyframes = 0;
  for (const anim of anims) {
    for (const sampler of anim.listSamplers()) {
      const input = sampler.getInput();
      if (input) keyframes += input.getCount();
    }
  }
  summary.keyframes = keyframes;

  // Materials
  const materials = root.listMaterials();
  summary.materials = materials.length;
  summary.materialNames = materials.map((m, i) => m.getName() || `material_${i}`);

  // Textures
  const textures = root.listTextures();
  summary.textures = textures.length;
  summary.textureNames = textures.map((t, i) => t.getName() || t.getURI() || `texture_${i}`);

  return summary;
}
