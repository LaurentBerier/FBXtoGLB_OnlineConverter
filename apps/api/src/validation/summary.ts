/** Normalised description of a 3D asset, used to compare input vs output. */
export interface AssetSummary {
  /** Number of distinct mesh resources. */
  meshes: number;
  /** Number of skeleton bones / joints. */
  bones: number;
  boneNames: string[];
  /** True when at least one skin/skin-cluster binds mesh to skeleton. */
  hasSkin: boolean;
  /** True when per-vertex skin weights were found. */
  hasSkinWeights: boolean;
  /** Animation clip count. */
  animations: number;
  animationNames: string[];
  /** Total animation keyframes across all curves (best effort). */
  keyframes: number;
  materials: number;
  materialNames: string[];
  textures: number;
  textureNames: string[];
  nodeNames: string[];
  /** Non-fatal notes collected while inspecting. */
  notes: string[];
}

export function emptySummary(): AssetSummary {
  return {
    meshes: 0,
    bones: 0,
    boneNames: [],
    hasSkin: false,
    hasSkinWeights: false,
    animations: 0,
    animationNames: [],
    keyframes: 0,
    materials: 0,
    materialNames: [],
    textures: 0,
    textureNames: [],
    nodeNames: [],
    notes: [],
  };
}
