# Stage 1: Install all dependencies (including devDeps) with native build tools
# needed to compile better-sqlite3 bindings.
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci

# Stage 2: Build the Vite frontend.
# VITE_API_URL="" makes all API calls relative to the same origin (served by Express).
FROM deps AS frontend-build
COPY shared/src ./shared/src
COPY frontend/ ./frontend/
RUN VITE_API_URL="" npm run build -w frontend

# Stage 3: Compile the backend TypeScript.
FROM deps AS backend-build
COPY shared/src ./shared/src
COPY backend/ ./backend/
RUN npm run build -w backend

# Stage 4: Minimal production runtime image.
FROM node:22-alpine AS runtime
WORKDIR /app

# Install production dependencies only.
# Build tools are required to recompile better-sqlite3 native bindings for this
# Alpine environment, then removed to keep the final image lean.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN apk add --no-cache python3 make g++ && \
    npm ci --omit=dev && \
    apk del python3 make g++

# Compiled backend JS and Drizzle migration files.
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/drizzle ./backend/drizzle

# Frontend static assets served by Express in production.
COPY --from=frontend-build /app/frontend/dist ./frontend-dist

# Shared TypeScript source is loaded at runtime via the @habitsapp/shared
# workspace symlink. Node 22's --experimental-transform-types handles it.
COPY shared/src ./shared/src

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL=./habits.db
ENV FRONTEND_DIST_DIR=/app/frontend-dist

EXPOSE 3001

CMD ["node", "--experimental-transform-types", "backend/dist/index.js"]
