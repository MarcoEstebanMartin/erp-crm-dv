# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias necesarias para compilar/generar
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Copiar el resto del código y compilar
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Instalar solo dependencias de producción
COPY package*.json ./
RUN npm ci --only=production

# Copiar archivos compilados y prisma generado
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/index.js"]
