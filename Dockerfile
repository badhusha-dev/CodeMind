# syntax=docker/dockerfile:1

# 1) Base deps layer (install all deps once)
FROM node:20-bullseye-slim AS deps
WORKDIR /app

# Install dependencies only using lockfile for reproducibility
COPY package*.json ./
RUN npm ci --omit=optional

# 2) Builder: copy source and build (client + server)
FROM node:20-bullseye-slim AS builder
WORKDIR /app
ENV NODE_ENV=production

# Reuse node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the source
COPY . .

# Build client (Vite -> dist/public) and server bundle (esbuild -> dist/index.js)
RUN npm run build

# 3) Runtime: install only production deps and copy build artifacts
FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

# Copy built output
COPY --from=builder /app/dist ./dist

# App listens on 5000 by default (can be overridden with PORT env)
EXPOSE 5000

# Start the production server
CMD ["npm", "run", "start"]