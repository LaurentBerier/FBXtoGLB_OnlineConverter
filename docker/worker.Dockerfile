# ---------------------------------------------------------------------------
# Conversion worker / API image.
# Bundles Node + the two conversion engines (FBX2glTF and headless Blender)
# so a container can run the full FBX <-> GLB pipeline with no host setup.
# Build from the repository root:
#   docker build -f docker/worker.Dockerfile -t fbxglb-worker .
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS base

# Versions are build args so they are easy to bump.
ARG BLENDER_MAJOR=4.2
ARG BLENDER_VERSION=4.2.3
ARG FBX2GLTF_URL=https://github.com/godotengine/FBX2glTF/releases/download/v0.13.1/FBX2glTF-linux-x86_64

ENV DEBIAN_FRONTEND=noninteractive

# Runtime libraries Blender needs to run headless ("--background").
RUN apt-get update && apt-get install -y --no-install-recommends \
      wget xz-utils ca-certificates \
      libx11-6 libxi6 libxxf86vm1 libxfixes3 libxrender1 libxkbcommon0 \
      libgl1 libglu1-mesa libsm6 libice6 libdbus-1-3 \
    && rm -rf /var/lib/apt/lists/*

# --- Install Blender (headless) ---
RUN wget -q "https://download.blender.org/release/Blender${BLENDER_MAJOR}/blender-${BLENDER_VERSION}-linux-x64.tar.xz" -O /tmp/blender.tar.xz \
    && mkdir -p /opt/blender \
    && tar -xf /tmp/blender.tar.xz -C /opt/blender --strip-components=1 \
    && ln -s /opt/blender/blender /usr/local/bin/blender \
    && rm /tmp/blender.tar.xz \
    && blender --version

# --- Install FBX2glTF ---
RUN wget -q "${FBX2GLTF_URL}" -O /usr/local/bin/FBX2glTF \
    && chmod +x /usr/local/bin/FBX2glTF \
    && FBX2glTF --version || true

# --- Build the API (treated as a standalone package inside the image) ---
WORKDIR /app
COPY apps/api/package.json ./package.json
RUN npm install
COPY apps/api/ ./
RUN npm run build

ENV NODE_ENV=production \
    API_PORT=4000 \
    API_HOST=0.0.0.0 \
    STORAGE_DIR=/data \
    BLENDER_PATH=/usr/local/bin/blender \
    FBX2GLTF_PATH=/usr/local/bin/FBX2glTF

VOLUME ["/data"]
EXPOSE 4000

# Basic healthcheck against the /api/health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

CMD ["node", "dist/index.js"]
