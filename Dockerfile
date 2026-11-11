# ==============================================================================
# ERP-CRM DV — Imagen Unificada de Producción para Railway (Frontend + Backend)
# ==============================================================================

# Etapa 1: Compilar Frontend SPA (React 19 + Vite 8)
FROM node:24-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ARG VITE_GOOGLE_MAPS_API_KEY=""
ENV VITE_GOOGLE_MAPS_API_KEY=${VITE_GOOGLE_MAPS_API_KEY}
RUN npm run build

# Etapa 2: Compilar Backend API + Generar Cliente Prisma
FROM node:24-slim AS backend-builder
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend

COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm ci

COPY backend/ ./
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

# Etapa 3: Runtime Liviano y Endurecido (Usuario no-root + pg_dump para backups SQL completos)
FROM node:24-slim AS runner
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates postgresql-client && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=backend-builder /app/backend/package*.json ./
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

RUN mkdir -p /app/backend/uploads/products /app/backend/backups /app/backend/certs \
    && chown -R node:node /app

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
