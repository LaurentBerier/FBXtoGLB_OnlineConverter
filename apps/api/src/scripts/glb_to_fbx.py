"""
Headless Blender bridge: import a GLB/glTF and export FBX while preserving
armature, skin weights, animations and PBR materials with embedded textures.

Invoked as:
  blender --background --factory-startup --python glb_to_fbx.py -- \
      --input model.glb --output model.fbx
"""

import argparse
import sys

import bpy


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    parser = argparse.ArgumentParser(description="GLB -> FBX via Blender")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--up-axis", dest="up_axis", choices=["y", "z"], default="y")
    return parser.parse_args(argv)


def clear_scene():
    """Factory startup ships a cube/camera/light; remove everything first."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def summarize():
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    armatures = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    bones = sum(len(a.data.bones) for a in armatures)
    actions = len(bpy.data.actions)
    materials = len(bpy.data.materials)
    images = len(bpy.data.images)
    print(
        f"[bridge] imported: meshes={len(meshes)} armatures={len(armatures)} "
        f"bones={bones} actions={actions} materials={materials} images={images}"
    )


def main():
    args = parse_args()
    print(f"[bridge] input={args.input}")
    print(f"[bridge] output={args.output}")

    clear_scene()

    # Import glTF/GLB. Blender's importer brings in armature, skin weights,
    # shape keys, animations (as Actions) and materials.
    bpy.ops.import_scene.gltf(filepath=args.input, import_pack_images=True)
    summarize()

    # Output up-axis: Y-up (glTF standard) or Z-up (Unreal / 3ds Max convention).
    if args.up_axis == "z":
        axis_up, axis_forward = "Z", "-Y"
    else:
        axis_up, axis_forward = "Y", "-Z"
    print(f"[bridge] up_axis={args.up_axis} (axis_up={axis_up}, axis_forward={axis_forward})")

    # Export FBX with rigging + animation + materials preserved.
    bpy.ops.export_scene.fbx(
        filepath=args.output,
        use_selection=False,
        apply_scale_options="FBX_SCALE_NONE",
        apply_unit_scale=True,
        bake_space_transform=False,
        object_types={"ARMATURE", "MESH", "EMPTY"},
        use_mesh_modifiers=True,
        mesh_smooth_type="FACE",
        use_armature_deform_only=False,
        add_leaf_bones=False,
        primary_bone_axis="Y",
        secondary_bone_axis="X",
        bake_anim=True,
        bake_anim_use_all_bones=True,
        bake_anim_use_nla_strips=True,
        bake_anim_use_all_actions=True,
        bake_anim_force_startend_keying=True,
        path_mode="COPY",
        embed_textures=True,
        axis_forward=axis_forward,
        axis_up=axis_up,
    )
    print("[bridge] export complete")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 - surface any failure to the caller
        print(f"[bridge] ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
