# FBX ⇄ GLB Converter

A lightweight, professional web app for **high-fidelity FBX ↔ GLB conversion** that
preserves geometry, skeletons, skinning, animations, PBR materials and textures —
so a rigged character from Maya, Blender, 3ds Max, Mixamo, Unreal, Unity or Rokoko
survives the round-trip.

Every conversion ships a **validation report**:

```
✓ Meshes: 12/12 preserved
✓ Bones: 127/127 preserved
✓ Skinning: Preserved (clusters + weights)
✓ Animations: 4 clips preserved
✓ Materials: 8/8 preserved
✓ Textures: 14/14 preserved
```

## How it works

| Direction   | Engine                          | Why |
|-------------|---------------------------------|-----|
| **FBX → GLB** | [FBX2glTF](https://github.com/godotengine/FBX2glTF) | Best-in-class preservation of skeletons, skin clusters, animations and PBR materials. |
| **GLB → FBX** | Headless **Blender** + Python   | Blender's glTF importer + FBX exporter retains armature, skin weights, animation actions and materials. |

After conversion the API independently **inspects** the source and the output
(geometry, bones, skin weights, animation clips/keyframes, materials, textures)
and produces a side-by-side fidelity report.

### Preview & optimize

- **3D preview** — an in-browser Three.js viewer (orbit, wireframe, auto-rotate,
  grid) shows the model before conversion and the result after, for both GLB and
  FBX. Loaded lazily so the landing page stays light.
- **Optimization** (FBX→GLB output) — optional, never on by default:
  - **Draco** geometry compression (skin weights kept at high precision),
  - texture **resize** + re-encode to **WebP/JPEG**,
  - **cleanup** (prune unused + dedup),
  - the report shows the before→after size and % saved.

## Architecture

```
apps/
  web/   Next.js 14 + React + TypeScript + Tailwind + shadcn-style UI
  api/   Express + TypeScript: upload → validate → convert → verify → report
docker/
  worker.Dockerfile   Node + FBX2glTF + headless Blender (the conversion worker/API)
  web.Dockerfile      Next.js standalone image
docker-compose.yml    web + worker
```

- **Frontend** (Vercel-friendly): drag-and-drop upload, format selector, progress
  bar, download button, validation report.
- **API / worker** (Docker): a concurrency-limited queue runs the conversion
  pipeline. The queue + job store are isolated behind small interfaces so they
  can be swapped for Redis/BullMQ and Postgres in a clustered deployment.
- **Storage**: temporary per-job directories, **auto-deleted after 24h** by a
  background sweeper.

## Quick start (local dev)

Prerequisites: Node 20+, and the conversion engines installed — see
[SETUP.md](./SETUP.md). You can run the UI without engines; conversions will
report a clear "engine not installed" message.

```bash
npm install

# configure (optional — sensible defaults are used)
cp .env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local

# check which engines are detected
npm run doctor

# run API (:4000) and web (:3000) together
npm run dev
```

Open <http://localhost:3000>.

## Run with Docker (engines bundled)

The worker image installs FBX2glTF **and** Blender, so no host setup is needed:

```bash
docker compose up --build
# web  -> http://localhost:3000
# api  -> http://localhost:4000/api/health
```

## API

| Method | Endpoint                  | Description |
|--------|---------------------------|-------------|
| `GET`  | `/api/health`             | Liveness probe. |
| `GET`  | `/api/capabilities`       | Limits, queue depth, which engines/directions are available. |
| `POST` | `/api/convert`            | Multipart upload (`file`, optional `direction`). Returns a job. |
| `GET`  | `/api/jobs/:id`           | Job status, progress and report. |
| `GET`  | `/api/jobs/:id/download`  | Download the converted file. |
| `GET`  | `/api/jobs/:id/report`    | Validation report as JSON. |

## Security

- 500 MB upload cap (configurable), single file per request.
- Extension + **magic-byte signature** validation; optional **ClamAV** virus scan.
- Per-IP **rate limiting**.
- Temporary files **auto-deleted after 24h**; filenames sanitised against path traversal.

## Validation coverage

Geometry (mesh count) · Skeleton (bone count + names) · Skinning (clusters +
vertex weights) · Animation (clip count + keyframes) · Materials (count) ·
Textures (count + resolution). FBX counts are read with a binary/ASCII FBX
parser; GLB/glTF with [`@gltf-transform`](https://gltf-transform.dev/).

## Deploy

- **Frontend → Vercel.** Set `NEXT_PUBLIC_API_BASE_URL` to your API URL.
- **Worker/API → Docker** on any host (Fly.io, Render, ECS, a VM). Mount a
  volume at `/data`. Scale replicas horizontally for more throughput.

## Roadmap

- **Phase 2** — batch conversion; OBJ, STL, USDZ/USD, DAE, BLEND, Maya ASCII/Binary.
- **Phase 3** — animation playback in the viewer, skeleton/material/texture
  inspectors (a basic 3D preview already ships).

See [SETUP.md](./SETUP.md) for installing the conversion engines and
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the pipeline details.
