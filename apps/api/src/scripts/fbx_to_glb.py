"""
Headless Blender bridge: import an FBX and export a binary GLB while preserving
armature, skin weights, animations and PBR materials. Unlike FBX2glTF this path
keeps smooth vertex normals + tangents and links normal/PBR maps, and re-encodes
textures (e.g. .tga) to PNG so the GLB is spec-conformant and previews cleanly.

The GLB is always written Y-up (glTF spec); a Z-up output is produced afterwards
by the gltf-transform pivot rewrite in the Node pipeline (see upAxis.ts).

Invoked as:
  blender --background --factory-startup --python fbx_to_glb.py -- \
      --input model.fbx --output model.glb
"""

import argparse
import sys

import bpy


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    parser = argparse.ArgumentParser(description="FBX -> GLB via Blender")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
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
    images = [i for i in bpy.data.images if i.source == "FILE"]
    print(
        f"[bridge] imported: meshes={len(meshes)} armatures={len(armatures)} "
        f"bones={bones} actions={actions} materials={materials} images={len(images)}"
    )


def export_glb(outp, has_anim):
    # AUTO image format re-encodes non-PNG/JPEG sources (e.g. .tga) to PNG so the
    # GLB is conformant; tangents are needed for correct normal mapping.
    kwargs = dict(
        filepath=outp,
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_normals=True,
        export_tangents=True,
        export_skins=True,
        export_animations=has_anim,
    )
    try:
        bpy.ops.export_scene.gltf(**kwargs)
        return
    except TypeError as exc:
        # Exporter kwarg names drift between Blender versions; fall back to the
        # stable core (defaults already cover AUTO images, materials, skins).
        print(f"[bridge] full export kwargs rejected ({exc}); retrying minimal", file=sys.stderr)
    bpy.ops.export_scene.gltf(filepath=outp, export_format="GLB", export_yup=True)


def main():
    args = parse_args()
    print(f"[bridge] input={args.input}")
    print(f"[bridge] output={args.output}")

    clear_scene()

    # Import FBX. Blender brings in the armature, skin weights, animations (as
    # Actions), materials and embedded textures, and reads custom split normals.
    bpy.ops.import_scene.fbx(filepath=args.input)
    summarize()

    has_anim = len(bpy.data.actions) > 0
    print(f"[bridge] has_anim={has_anim} (actions={len(bpy.data.actions)})")

    export_glb(args.output, has_anim)
    print("[bridge] export complete")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 - surface any failure to the caller
        print(f"[bridge] ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
