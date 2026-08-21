# ChainTrace — Production Deployment Guide

> Generated from a full inspection of the repository on 2026-08-21.
> Every recommendation below is based on what actually exists in the codebase.

---

## A. Current Architecture (Local)

```
┌─────────────────────────────────────────────────────────┐
│  YOUR LAPTOP                                            │
│                                                         │
│  ┌──────────────┐  HTTP  ┌──────────────┐  HTTP        │
│  │ Frontend     │──────→│ Backend      │──────→        │
│  │ Next.js      │  :3000 │ Bun+TS      │  :8443        │
│  │ :3001        │        │ :3000        │               │
│  └──────────────┘        └──────────────┘               │
│                                                         │
│  ┌──────────────┐                                       │
│  │ HydraDB      │                                       │
│  │ (Docker)     │                                       │
│  │ :8443        │                                       │
│  └──────────────┘                                       │
│         ↑                                               │
│    hydradb-data/                                        │
│    (bind mount)                                         │
│                                                         │
│  ┌──────────────┐  HTTP  ┌──────────────┐               │
│  │ CLI          │──────→│ Backend      │               │
│  │ chaintrace   │  :3000 │              │               │
│  └──────────────┘        └──────────────┘               │
└─────────────────────────────────────────────────────────┘
```

---

## B. Problems Preventing Deployment

### B1. Secrets Committed to Git

| File | Secret | Status |
|------|--------|--------|
| `backend/.env` | `HYDRA_TOKEN=local-development-token-32-bytes` | ⚠️ Committed to git |
| `cli/.env` | `GITHUB_CLIENT_ID=Ov23lib66aLVy6whutY4` | ⚠️ Committed to git |

**Both `.env` files are in git.** While `.gitignore` excludes `.env`, these files were added before the gitignore rule. The GitHub Client ID is not a secret (it's public in device flow), but the HydraDB token must change for production.

### B2. No Docker Compose

There is no `docker-compose.yml` anywhere in the project. HydraDB is started with a raw `docker run` command from `hydradb/README.md`. There is no orchestrated startup for backend + HydraDB together.

### B3. PORT Inconsistency

| File | Default PORT |
|------|-------------|
| `backend/src/server.ts` | `3000` |
| `backend/src/config.ts` | `3001` |

`server.ts` reads `process.env.PORT ?? 3000` directly (never imports `config.ts`). `config.ts` reads `process.env.PORT ?? 3001` but is never used by the server. This is a latent bug.

### B4. Hardcoded Localhost References

| File | Hardcoded Value | Context |
|------|----------------|---------|
| `backend/src/config.ts:7` | `http://127.0.0.1:8443` | HydraDB default URL |
| `cli/src/api/client.ts:93` | `http://localhost:3000` | API default URL |
| `cli/src/command/scan.ts:378` | `http://localhost:3001` | Dashboard link in output |
| `cli/src/command/check.ts:51` | `http://localhost:3001` | Dashboard link in output |

These are defaults that will work locally but break in production. They are overridable via env vars except the dashboard links.

### B5. No Backend Dockerfile

The backend has no `Dockerfile`. It needs one to run in production as a container.

### B6. No Frontend Production Config

The frontend `next.config.ts` is empty — no image domains, no rewrites, no output mode configured.

### B7. CLI Not Built for Distribution

- `cli/dist/chaintrace` exists but is a 63MB Bun-compiled binary (platform-specific)
- No `.npmignore` file
- `package.json` has `"private"` field absent (good for npm publish)
- CLI does NOT load dotenv (`import "dotenv/config"` is absent)
- CLI reads `CHAINTRACE_API_URL` from env at runtime — works for production

---

## C. Recommended Production Architecture

```
┌─────────────────────────────────────────────────────────┐
│  PRODUCTION SERVER (single machine)                     │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐                    │
│  │ nginx       │    │ Caddy       │                    │
│  │ (reverse    │ OR │ (auto TLS)  │                    │
│  │  proxy)     │    │             │                    │
│  │ :443/:80    │    │ :443/:80    │                    │
│  └──────┬──────┘    └──────┬──────┘                    │
│         │                  │                            │
│    ┌────┴──────────────────┴────┐                      │
│    │                             │                      │
│    ▼                             ▼                      │
│  ┌──────────────┐   ┌──────────────────┐               │
│  │ Frontend     │   │ Backend          │               │
│  │ Next.js      │   │ Bun + TS         │               │
│  │ :3001        │   │ :3000            │               │
│  │ (static      │   │                  │               │
│  │  export)     │   └────────┬─────────┘               │
│  └──────────────┘            │ HTTP (private)          │
│                              ▼                          │
│                    ┌──────────────────┐                 │
│                    │ HydraDB          │                 │
│                    │ (Docker)         │                 │
│                    │ :8443 (internal) │                 │
│                    └────────┬─────────┘                 │
│                             │ bind mount               │
│                             ▼                          │
│                    ┌──────────────────┐                 │
│                    │ /opt/chaintrace/ │                 │
│                    │   data/          │                 │
│                    └──────────────────┘                 │
│                                                         │
│  CLI ──HTTPS──→ nginx:443 ──→ Backend :3000            │
└─────────────────────────────────────────────────────────┘
```

**Key decisions:**
- Backend + HydraDB on **one server** (Docker Compose)
- Frontend deployed as **static export** (no Node.js server needed)
- HydraDB on **private Docker network** — never exposed to internet
- Caddy or nginx as **reverse proxy** with auto TLS (Let's Encrypt)
- CLI talks to the **public API URL** via HTTPS

---

## D. Backend Dockerfile

**File: `backend/Dockerfile`**

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies (cached layer)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source
COPY src/ src/
COPY tsconfig.json ./

# The server reads .env at runtime via dotenv/config
# Do NOT bake .env into the image

EXPOSE 3000

CMD ["bun", "src/server.ts"]
```

---

## E. Docker Compose

**File: `docker-compose.yml`** (project root)

```yaml
version: "3.8"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: chaintrace-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - HYDRA_URL=http://hydradb:8443
      - HYDRA_TOKEN=${HYDRA_TOKEN}
      - HYDRA_NAMESPACE=${HYDRA_NAMESPACE:-default}
      - HYDRA_CELL_ID=${HYDRA_CELL_ID:-cell-0}
    depends_on:
      hydradb:
        condition: service_healthy
    networks:
      - chaintrace-internal
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 5s

  hydradb:
    image: hydradb:local
    container_name: chaintrace-hydradb
    restart: unless-stopped
    # NO ports exposed to host — only accessible via Docker network
    environment:
      - CLOUD_PROVIDER=local
      - LOCAL_PATH=/data/store
      - GRAPH_NAMESPACE=${HYDRA_NAMESPACE:-default}
      - GRAPH_ID=default
      - GRAPH_CELL_ID=${HYDRA_CELL_ID:-cell-0}
      - GRAPH_CELLS=cell-0
      - GRAPH_NODE_ID=node-0
      - AUTH_TOKEN=${HYDRA_TOKEN}
    volumes:
      - hydradb-data:/data
    networks:
      - chaintrace-internal
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8443/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

networks:
  chaintrace-internal:
    driver: bridge

volumes:
  hydradb-data:
    driver: local
```

**Note:** The HydraDB image must be pre-built locally: `cd hydradb && docker build -t hydradb:local .`

---

## F. Production .env.example

**File: `.env.production`** (project root, NOT committed)

```bash
# ═══════════════════════════════════════════════════════
# ChainTrace Production Environment
# ═══════════════════════════════════════════════════════

# HydraDB — generate a real 32-byte token for production
# Do NOT use the local-development-token
HYDRA_TOKEN=<generate-with: openssl rand -hex 32>
HYDRA_NAMESPACE=default
HYDRA_CELL_ID=cell-0

# Backend
PORT=3000

# Frontend (build-time only, baked into static export)
NEXT_PUBLIC_CHAINTRACE_API=https://api.chaintrace.dev

# CLI (set on user's machine, not server)
CHAINTRACE_API_URL=https://api.chaintrace.dev

# GitHub OAuth (Device Flow — Client ID is public)
GITHUB_CLIENT_ID=Ov23lib66aLVy6whutY4
```

---

## G. Persistent Volume Configuration

The HydraDB data volume stores the graph. In Docker Compose, it's defined as:

```yaml
volumes:
  hydradb-data:
    driver: local
```

Docker stores this at `/var/lib/docker/volumes/<project>_hydradb-data/_data/`.

**For production backup:**

```bash
# Backup
docker run --rm \
  -v chaintrace_hydradb-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/hydradb-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restore
docker run --rm \
  -v chaintrace_hydradb-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/hydradb-backup-YYYYMMDD.tar.gz -C /data
```

---

## H. Networking / Ports

| Service | Internal Port | External Port | Exposed? |
|---------|--------------|---------------|----------|
| nginx/Caddy | 80, 443 | 80, 443 | ✅ Public |
| Backend | 3000 | — | ❌ Behind reverse proxy |
| HydraDB | 8443 | — | ❌ Private network only |

**Firewall rules (Oracle Cloud / any VPS):**
```bash
# Allow HTTP and HTTPS only
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
# Block everything else
ufw enable
```

---

## I. HTTPS / Reverse Proxy Setup

### Option 1: Caddy (recommended — auto TLS)

```bash
# Install Caddy
apt install -y caddy

# Create Caddyfile
cat > /etc/caddy/Caddyfile << 'EOF'
api.chaintrace.dev {
    reverse_proxy localhost:3000

    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }
}

chaintrace.dev {
    reverse_proxy localhost:3001

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }
}
EOF

# Restart Caddy
systemctl restart caddy
```

### Option 2: nginx + Certbot

```bash
apt install -y nginx certbot python3-certbot-nginx

cat > /etc/nginx/sites-available/chaintrace << 'EOF'
server {
    listen 80;
    server_name api.chaintrace.dev;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.chaintrace.dev;

    ssl_certificate /etc/letsencrypt/live/api.chaintrace.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.chaintrace.dev/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name chaintrace.dev;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name chaintrace.dev;

    ssl_certificate /etc/letsencrypt/live/chaintrace.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chaintrace.dev/privkey.pem;

    root /var/www/chaintrace;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

ln -s /etc/nginx/sites-available/chaintrace /etc/nginx/sites-enabled/
certbot --nginx -d api.chaintrace.dev -d chaintrace.dev
systemctl restart nginx
```

---

## J. Exact Server Setup Commands

```bash
# ── 1. Provision server (Ubuntu 22.04/24.04) ──────────────

# SSH into your server
ssh root@<SERVER_IP>

# ── 2. System updates ─────────────────────────────────────

apt update && apt upgrade -y
apt install -y curl git ufw

# ── 3. Install Docker ─────────────────────────────────────

curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER
# Log out and back in for docker group to take effect

# ── 4. Install Bun ────────────────────────────────────────

curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# ── 5. Install Node.js (for frontend build) ───────────────

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pnpm

# ── 6. Install Caddy ─────────────────────────────────────

apt install -y caddy

# ── 7. Firewall ───────────────────────────────────────────

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# ── 8. Clone repository ───────────────────────────────────

cd /opt
git clone <your-repo-url> chaintrace
cd chaintrace

# ── 9. Create production .env ─────────────────────────────

cat > .env << 'EOF'
HYDRA_TOKEN=$(openssl rand -hex 32)
HYDRA_NAMESPACE=default
HYDRA_CELL_ID=cell-0
PORT=3000
EOF

# ── 10. Build HydraDB Docker image ────────────────────────

cd hydradb
docker build -t hydradb:local .
cd ..

# ── 11. Start backend + HydraDB ───────────────────────────

docker compose up -d --build

# ── 12. Wait for health checks ────────────────────────────

sleep 15
docker compose ps
curl http://localhost:3000/health

# ── 13. Configure DNS ─────────────────────────────────────
# Point these A records to <SERVER_IP>:
#   chaintrace.dev → <SERVER_IP>
#   api.chaintrace.dev → <SERVER_IP>

# ── 14. Configure Caddy ───────────────────────────────────

cat > /etc/caddy/Caddyfile << 'EOF'
api.chaintrace.dev {
    reverse_proxy localhost:3000
}
chaintrace.dev {
    reverse_proxy localhost:3001
}
EOF

systemctl restart caddy

# ── 15. Build frontend (static export) ────────────────────

cd front-end
NEXT_PUBLIC_CHAINTRACE_API=https://api.chaintrace.dev \
  pnpm install && pnpm build

# For static export, copy .next/static to nginx root:
mkdir -p /var/www/chaintrace
cp -r .next/static /var/www/chaintrace/_next/static
cp -r public/* /var/www/chaintrace/ 2>/dev/null || true
# (or use `next export` if configured for static output)

# ── 16. Set up systemd for frontend (if not static) ───────

cat > /etc/systemd/system/chaintrace-frontend.service << 'EOF'
[Unit]
Description=ChainTrace Frontend
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/chaintrace/front-end
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=NEXT_PUBLIC_CHAINTRACE_API=https://api.chaintrace.dev
ExecStart=/usr/bin/node_modules/.bin/next start -p 3001
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now chaintrace-frontend

# ── 17. Verify everything ─────────────────────────────────

curl -s https://api.chaintrace.dev/health
curl -s https://chaintrace.dev/ | head -5
```

---

## K. Deployment Commands (Quick Reference)

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f backend
docker compose logs -f hydradb

# Restart backend only
docker compose restart backend

# Full rebuild
docker compose down
docker compose up -d --build

# Stop everything
docker compose down

# Stop and remove volumes (DANGER: deletes graph data)
docker compose down -v
```

---

## L. Backend Configuration Changes Required

### L1. Fix PORT inconsistency

**File: `backend/src/server.ts`** — change line 12:
```ts
// BEFORE (inconsistent with config.ts)
const PORT = Number(process.env.PORT ?? 3000);

// AFTER (use config.ts as single source of truth)
import { config } from "./config";
const PORT = config.port;
```

**Or** — simpler: make both files agree:
```ts
// server.ts — keep as-is (3000)
// config.ts — change to match:
port: Number(process.env.PORT ?? 3000),
```

### L2. No code changes needed for production

- `HYDRA_URL` defaults to `http://127.0.0.1:8443` — overridden via env var in Docker Compose to `http://hydradb:8443`
- `HYDRA_TOKEN` — overridden via env var (use a real token, not the dev one)
- `PORT` — overridden via env var
- CORS is already `*` — fine for API, tighten for production if needed

---

## M. Frontend Environment Variables

```bash
# Build-time (baked into the static/SSR bundle)
NEXT_PUBLIC_CHAINTRACE_API=https://api.chaintrace.dev
```

**This is the only env var the frontend needs.** It's read client-side via `process.env.NEXT_PUBLIC_CHAINTRACE_API` in `src/lib/api.ts`.

---

## N. CLI Changes for Production

### N1. API URL Configuration (already works)

The CLI reads `CHAINTRACE_API_URL` from env:
```ts
// cli/src/api/client.ts:91-93
const API_URL = process.env.CHAINTRACE_API_URL ?? "http://localhost:3000";
```

**For production users, they set:**
```bash
export CHAINTRACE_API_URL=https://api.chaintrace.dev
```

### N2. Dashboard Links (hardcoded localhost)

These are cosmetic (shown in terminal output after scan/check). For production, they should point to the deployed frontend. Two options:

**Option A: Make configurable** (recommended)

Add `CHAINTRACE_DASHBOARD_URL` env var:
```ts
// cli/src/command/scan.ts line 378
const DASHBOARD_URL = process.env.CHAINTRACE_DASHBOARD_URL ?? "http://localhost:3001";

// cli/src/command/check.ts line 51
const DASHBOARD_URL = process.env.CHAINTRACE_DASHBOARD_URL ?? "http://localhost:3001";
```

**Option B: Leave as-is** (users can set it, most won't notice)

### N3. GitHub OAuth (already works)

Device flow doesn't need a callback URL. The `GITHUB_CLIENT_ID` is public (visible in the CLI binary). No changes needed.

### N4. .npmignore (create before publishing)

**File: `cli/.npmignore`**
```
src/
node_modules/
.env
.env.*
tsconfig.json
bun.lock
*.tgz
dist/chaintrace  # don't ship the binary — users build from source
```

**Wait** — the CLI compiles to a single binary. For npm publishing, you want to ship the source + let users compile, OR ship the compiled binary. Since `bin.chaintrace` points to `./dist/chaintrace`, you need to include the binary:

**Revised `.npmignore`:**
```
src/
node_modules/
.env
.env.*
tsconfig.json
bun.lock
*.tgz
```

This ships `dist/chaintrace` (the binary) and `package.json`.

---

## O. npm Publishing Steps

```bash
cd cli

# 1. Build for current platform
bun run build
# Produces: dist/chaintrace (single binary)

# 2. Login to npm
npm login

# 3. Dry run — verify what will be published
npm pack --dry-run

# 4. Publish
npm publish

# 5. Users install globally
npm install -g chaintrace

# 6. Verify
chaintrace --version
chaintrace --help
```

**For cross-platform publishing** (Linux, macOS, macOS ARM):

This requires building on each platform or using CI. For now, publish from your Mac — the binary will be macOS ARM. For Linux users, they'd need to build from source:

```bash
# User installs from source
git clone <repo>
cd cli
bun install
bun run build
# Binary at dist/chaintrace
```

---

## P. Deployment Verification Commands

```bash
# ── 1. Backend health ─────────────────────────────────────
curl -s http://localhost:3000/health
# Expected: {"status":"ok","service":"chaintrace"}

# ── 2. HydraDB connectivity (via backend) ─────────────────
curl -s http://localhost:3000/services
# Expected: {"success":true,"count":0,"services":[]}
# (or existing services if data was migrated)

# ── 3. CORS preflight ─────────────────────────────────────
curl -s -D- -o /dev/null -X OPTIONS http://localhost:3000/health \
  -H "Origin: https://chaintrace.dev" \
  -H "Access-Control-Request-Method: GET"
# Expected: 204 with Access-Control-Allow-Origin: *

# ── 4. HTTPS endpoint ─────────────────────────────────────
curl -s https://api.chaintrace.dev/health
# Expected: {"status":"ok","service":"chaintrace"}

# ── 5. Frontend ───────────────────────────────────────────
curl -s https://chaintrace.dev/ | head -5
# Expected: HTML with ChainTrace content

# ── 6. Docker containers ──────────────────────────────────
docker compose ps
# Expected: both backend and hydradb "Up (healthy)"

# ── 7. HydraDB data persistence ───────────────────────────
docker compose down
docker compose up -d
curl -s http://localhost:3000/health
# Expected: still returns data (volumes preserved)

# ── 8. CLI against production ─────────────────────────────
CHAINTRACE_API_URL=https://api.chaintrace.dev chaintrace check axios@1.7.2
# Expected: full analysis output

# ── 9. Frontend API calls ─────────────────────────────────
# Open browser DevTools → Network tab → visit chaintrace.dev/console/services
# Expected: XHR request to api.chaintrace.dev/services returns JSON
```

---

## Q. Backup / Recovery Strategy for HydraDB Data

### Automated Backup (cron)

```bash
# Add to crontab: crontab -e
# Daily backup at 2 AM
0 2 * * * docker run --rm -v chaintrace_hydradb-data:/data -v /opt/backups:/backup alpine tar czf /backup/hydradb-$(date +\%Y\%m\%d).tar.gz -C /data . && find /opt/backups -name "hydradb-*.tar.gz" -mtime +7 -delete
```

### Manual Backup

```bash
docker compose stop backend  # stop writes
docker run --rm \
  -v chaintrace_hydradb-data:/data \
  -v /opt/backups:/backup \
  alpine tar czf /backup/hydradb-manual-$(date +%Y%m%d-%H%M).tar.gz -C /data .
docker compose start backend
```

### Recovery

```bash
docker compose down
docker run --rm \
  -v chaintrace_hydradb-data:/data \
  -v /opt/backups:/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/hydradb-YYYYMMDD.tar.gz -C /data"
docker compose up -d
```

---

## R. Security Checklist

- [ ] **HydraDB token** — generate a real 32-byte token: `openssl rand -hex 32`
- [ ] **HydraDB not exposed** — no port mapping to host in docker-compose (only internal network)
- [ ] **HTTPS** — Caddy or nginx with Let's Encrypt for all public endpoints
- [ ] **.env not in git** — `backend/.env` and `cli/.env` are in git history. Either:
  - Use `git filter-branch` or BFG to remove them, OR
  - Accept they're in history and rotate all secrets
- [ ] **Firewall** — only ports 22, 80, 443 open
- [ ] **Docker** — backend runs as non-root (Bun image default)
- [ ] **HydraDB** — runs as UID 10001 (graph user, not root)
- [ ] **CORS** — currently `*`. For production, consider restricting to `https://chaintrace.dev`
- [ ] **Rate limiting** — add at nginx/Caddy level for API endpoints
- [ ] **No `docker compose down -v` in production** — this destroys all data
- [ ] **GitHub OAuth** — Client ID is public (device flow), no secret exposure
- [ ] **CLI binary** — compiled Bun binary is large (~63MB), consider UPX compression

---

## "DO THIS NOW" — Deployment Sequence

Run these commands in order:

```bash
# ═══════════════════════════════════════════════════════════
# STEP 1: Generate production HydraDB token
# ═══════════════════════════════════════════════════════════

PROD_TOKEN=$(openssl rand -hex 32)
echo "Save this token: $PROD_TOKEN"

# ═══════════════════════════════════════════════════════════
# STEP 2: Create production .env on server
# ═══════════════════════════════════════════════════════════

cat > .env << EOF
HYDRA_TOKEN=$PROD_TOKEN
HYDRA_NAMESPACE=default
HYDRA_CELL_ID=cell-0
PORT=3000
EOF

# ═══════════════════════════════════════════════════════════
# STEP 3: Create backend Dockerfile
# ═══════════════════════════════════════════════════════════

# (see Section D above — create backend/Dockerfile)

# ═══════════════════════════════════════════════════════════
# STEP 4: Create docker-compose.yml
# ═══════════════════════════════════════════════════════════

# (see Section E above — create docker-compose.yml at root)

# ═══════════════════════════════════════════════════════════
# STEP 5: Build HydraDB image
# ═══════════════════════════════════════════════════════════

cd hydradb && docker build -t hydradb:local . && cd ..

# ═══════════════════════════════════════════════════════════
# STEP 6: Start backend + HydraDB
# ═══════════════════════════════════════════════════════════

docker compose up -d --build

# ═══════════════════════════════════════════════════════════
# STEP 7: Wait and verify
# ═══════════════════════════════════════════════════════════

sleep 20
docker compose ps
curl -s http://localhost:3000/health

# ═══════════════════════════════════════════════════════════
# STEP 8: Build frontend
# ═══════════════════════════════════════════════════════════

cd front-end
NEXT_PUBLIC_CHAINTRACE_API=https://api.chaintrace.dev pnpm install
NEXT_PUBLIC_CHAINTRACE_API=https://api.chaintrace.dev pnpm build

# ═══════════════════════════════════════════════════════════
# STEP 9: Configure Caddy
# ═══════════════════════════════════════════════════════════

cat > /etc/caddy/Caddyfile << 'EOF'
api.chaintrace.dev {
    reverse_proxy localhost:3000
}
chaintrace.dev {
    reverse_proxy localhost:3001
}
EOF

systemctl restart caddy

# ═══════════════════════════════════════════════════════════
# STEP 10: Publish CLI to npm
# ═══════════════════════════════════════════════════════════

cd cli
bun run build
npm publish

# ═══════════════════════════════════════════════════════════
# STEP 11: Final verification
# ═══════════════════════════════════════════════════════════

curl -s https://api.chaintrace.dev/health
curl -s https://chaintrace.dev/ | head -3
CHAINTRACE_API_URL=https://api.chaintrace.dev chaintrace check axios@1.7.2
```

---

## Summary of Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `backend/Dockerfile` | **CREATE** | Containerize the Bun backend |
| `docker-compose.yml` | **CREATE** | Orchestrate backend + HydraDB |
| `.env.production` | **CREATE** | Production env template (not committed) |
| `backend/src/server.ts` | **MODIFY** | Fix PORT inconsistency |
| `cli/.npmignore` | **CREATE** | Control npm publish contents |
| `cli/src/command/scan.ts` | **MODIFY** | Make dashboard URL configurable |
| `cli/src/command/check.ts` | **MODIFY** | Make dashboard URL configurable |
| `front-end/next.config.ts` | **MODIFY** | Add static export or production config |
| `.gitignore` | **MODIFY** | Add `.env*` to root gitignore |
