# Architecture

## Conversion pipeline

Each upload becomes a **job** processed by a concurrency-limited worker queue.
The pipeline (`apps/api/src/services/conversionService.ts`):

```
upload ─▶ validate (signature/scan) ─▶ inspect source ─▶ convert ─▶ inspect output ─▶ verify ─▶ report ─▶ download
```

1. **Upload & validate** — `multer` stages the file; `security/scan.ts` checks
   extension + magic bytes (and optional ClamAV). The file is moved into a
   per-job directory under `storage/jobs/<id>/`.
2. **Inspect source** — read counts (meshes, bones, skin weights, animations,
   keyframes, materials, textures) from the *input* so we have a baseline.
   - FBX: `validation/fbxInspect.ts` (binary/ASCII FBX parser).
   - GLB/glTF: `validation/gltfInspect.ts` (`@gltf-transform`).
3. **Convert** — `converters/fbx2glb.ts` (FBX2glTF) or `converters/glb2fbx.ts`
   (headless Blender + `scripts/glb_to_fbx.py`).
4. **Inspect output** — same inspectors applied to the *result*.
5. **Verify & report** — `validation/report.ts` compares source vs output into a
   `ConversionReport` with per-dimension `ok` / `warn` / `fail` checks and an
   overall verdict.

Progress is written to the in-memory job store and polled by the frontend.

## Components & swap points

| Concern | Implementation | Production swap |
|---------|----------------|-----------------|
| Job state | `queue/jobStore.ts` (in-memory `Map`) | Redis / Postgres |
| Queue | `queue/queue.ts` (concurrency-limited FIFO) | BullMQ / SQS |
| Storage | local `storage/` dir + sweeper | S3 + lifecycle rules |
| Engines | child-process spawn w/ auto-detect | dedicated worker pods |

These seams are intentionally small so a single-box deployment and a clustered
one share the same pipeline code.

## Engine flags (fidelity-critical)

**FBX2glTF**: `--binary --embed --pbr-metallic-roughness --keep-attribute auto`
— GLB output, embedded textures, PBR materials, and all present vertex
attributes (normals/uv/**joints/weights**/colors) kept.

**Blender FBX export**: `object_types={ARMATURE,MESH,EMPTY}`, `add_leaf_bones=False`,
`bake_anim=True` with `use_all_actions`/`use_all_bones`/`force_startend_keying`,
`path_mode=COPY`, `embed_textures=True` — armature, skin weights, every animation
action and materials/textures preserved.

## Validation semantics

- A count check is **ok** when `output ≥ source`, **fail** when `output < source`,
  and **warn** when the source count could not be determined (engine-specific).
- **Skinning** is **ok** only when the output has both skin clusters *and*
  per-vertex weights.
- Bone/animation **names** are diffed and surfaced as report notes.

## Failure handling

Missing engines, converter non-zero exits, empty outputs and parse failures are
caught per-job and surfaced as `status: "error"` with a readable message — the
server stays up and other jobs continue.
