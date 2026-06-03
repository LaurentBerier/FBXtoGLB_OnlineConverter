# Setup — installing the conversion engines

> **Fastest path:** run the one-shot setup script for your OS — it installs Node
> **and Blender**, the JS dependencies, and verifies everything:
>
> ```bash
> ./setup.sh                                            # macOS / Linux
> powershell -ExecutionPolicy Bypass -File setup.ps1    # Windows (or double-click setup.bat)
> ```
>
> The rest of this document is the manual reference.

**Blender is the only engine you need** — it drives **both** conversion
directions:

| Direction   | Engine                                   |
|-------------|------------------------------------------|
| FBX → GLB   | Blender (FBX2glTF optional fallback)     |
| GLB → FBX   | Blender                                  |

FBX2glTF is only used for FBX → GLB when Blender isn't available, and Blender
produces better results (smooth normals, linked normal/PBR maps, PNG textures),
so installing it is optional.

Run `npm run doctor` at any time to see what's detected:

```
npm run doctor
```

The API auto-detects binaries in this order:
1. Explicit env var (`FBX2GLTF_PATH` / `BLENDER_PATH`)
2. A `./bin` folder in the repo root
3. Your system `PATH`
4. Common install locations (Blender only)

---

## FBX2glTF (optional fallback for FBX → GLB)

Only needed if you want an FBX → GLB fallback for machines without Blender.
Download a prebuilt binary from the
[godotengine/FBX2glTF releases](https://github.com/godotengine/FBX2glTF/releases)
(the [facebookincubator/FBX2glTF](https://github.com/facebookincubator/FBX2glTF)
fork also works).

**Windows**
```powershell
# Download FBX2glTF-windows-x64.exe, then either:
#   - put it in <repo>\bin\FBX2glTF.exe, or
#   - set the path in apps/api/.env
$env:FBX2GLTF_PATH = "C:\tools\FBX2glTF.exe"
```

**macOS / Linux**
```bash
chmod +x FBX2glTF
mv FBX2glTF /usr/local/bin/        # or <repo>/bin/
# or: echo 'FBX2GLTF_PATH=/usr/local/bin/FBX2glTF' >> apps/api/.env
```

Verify: `FBX2glTF --version`

---

## Blender (required — drives both directions)

Install **Blender 3.6+ (4.x recommended)** from
<https://www.blender.org/download/>. The app runs it headless
(`blender --background`) with the bundled Python bridge at
`apps/api/src/scripts/glb_to_fbx.py`.

**Windows** — installed automatically into
`C:\Program Files\Blender Foundation\Blender 4.x\blender.exe` (auto-detected),
or set `BLENDER_PATH`.

**macOS**
```bash
echo 'BLENDER_PATH=/Applications/Blender.app/Contents/MacOS/Blender' >> apps/api/.env
```

**Linux**
```bash
sudo apt install blender        # or download the tarball
# auto-detected on PATH, or set BLENDER_PATH
```

Verify: `blender --version`

---

## Easiest option: Docker (engines pre-installed)

The worker image installs **both** engines for you:

```bash
docker compose up --build
```

No host installation required. The browser uses the API at
`http://localhost:4000`; change `NEXT_PUBLIC_API_BASE_URL` for other hosts.

---

## Optional: ClamAV virus scanning

Uploads are validated by extension + magic bytes by default. To also virus-scan:

```bash
# install clamav + clamav-daemon, then in apps/api/.env:
CLAMAV_ENABLED=true
CLAMDSCAN_PATH=clamdscan      # or absolute path
```

If the scanner is unreachable the API logs a warning and fails open (configurable
in `src/security/scan.ts`).

---

## Configuration reference

All settings live in `apps/api/.env` (copy from `.env.example`):

| Var | Default | Purpose |
|-----|---------|---------|
| `API_PORT` | `4000` | API port |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed web origin(s), comma-separated |
| `STORAGE_DIR` | `./storage` | Where uploads/outputs live |
| `RETENTION_HOURS` | `24` | Auto-delete age |
| `MAX_FILE_SIZE_MB` | `500` | Upload cap |
| `RATE_LIMIT_MAX_REQUESTS` | `60` | Per-IP per window |
| `MAX_CONCURRENT_JOBS` | `2` | Worker concurrency |
| `FBX2GLTF_PATH` | _(auto)_ | FBX2glTF binary |
| `BLENDER_PATH` | _(auto)_ | Blender binary |

## Security advisory note

The frontend pins Next.js `14.2.x` (latest patch). Newer advisories are fixed in
Next.js 16; they concern features this app does **not** use (next/image remote
patterns, rewrites, i18n, middleware, CSP nonces). For a hardened production
deploy, upgrade to Next.js 16 (requires React 19) — the UI is small and migrates
easily.
