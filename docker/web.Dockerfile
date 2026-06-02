# ---------------------------------------------------------------------------
# Next.js frontend image (standalone output).
# Build from the repository root:
#   docker build -f docker/web.Dockerfile -t fbxglb-web .
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY apps/web/package.json ./package.json
RUN npm install
COPY apps/web/ ./
# NEXT_PUBLIC_* must be present at build time to be inlined into the client bundle.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Standalone output includes a minimal server + only the deps it needs.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
