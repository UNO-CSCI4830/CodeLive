# ── Build stage ────────────────────────────────────────────────────────
FROM node:20-slim AS build
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────
FROM node:20-slim
WORKDIR /app/backend

# Python 3 is needed for the code-execution engine
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Python deps used by the backend challenge runner (/api/run/backend/python)
COPY backend/requirements-runner.txt ./
RUN python3 -m venv /opt/codelive-venv \
    && /opt/codelive-venv/bin/pip install --no-cache-dir -r requirements-runner.txt

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/backend/dist ./dist
# Runtime problem content is required by both /api/content and /api/run/backend/python.
COPY content ../content

EXPOSE 5000
ENV NODE_ENV=production
ENV PORT=5000
ENV PYTHON_BIN=/opt/codelive-venv/bin/python

USER node
CMD ["node", "dist/index.js"]
