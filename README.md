# ChainTrace

**Software supply-chain security platform** — map your dependencies into a graph, then trace the blast radius when a package is compromised.

ChainTrace crawls **npm** and **PyPI** registries, builds a dependency graph (packages → versions → maintainers → your services) in [HydraDB](./hydradb) (an object-store-native graph database), and answers the question that matters during an incident: *"package X@Y just turned malicious — which of my services are affected, how badly, and through what path?"*

```
┌──────────────┐  HTTP   ┌──────────────┐  OpenCypher  ┌──────────────┐
│ Front-end    │ ──────► │ Backend API  │ ───────────► │   HydraDB    │
│ Next.js :3000│         │ Bun + TS     │    :8443     │ Rust graph DB│
└──────────────┘         │ :3001        │              │ Bolt :7687   │
                         └──────▲───────┘              └──────────────┘
                                │ HTTP
                         ┌──────┴───────┐
                         │ chaintrace   │
                         │ CLI          │
                         └──────────────┘
```

## Repository layout

| Directory | What it is | Stack |
|---|---|---|
| [`backend/`](./backend) | REST API: registry ingestion, graph queries, risk/blast-radius/attack-path analysis | Bun + TypeScript |
| [`cli/`](./cli) | `chaintrace` CLI — scan lockfiles, check packages, GitHub device-flow login | Bun + TypeScript (compiled to a single binary) |
| [`front-end/`](./front-end) | Marketing site + operator console (3D dependency graph, risk dashboards) | Next.js 16, React 19, Tailwind 4, three.js |
| [`hydradb/`](./hydradb) | The graph database itself — object-store-native, OpenCypher + Bolt, GraphBLAS traversal | Rust (AGPL-3.0) |
| `docker-compose.yml` | Backend + HydraDB orchestration (currently commented out — see [DEPLOYMENT.md](./DEPLOYMENT.md)) | Docker |
| `.env.example` | Root environment template for HydraDB credentials | — |

## What it does

- **Ingest** — recursively crawl a package (`axios@1.7.2`) from npm or PyPI: every version, its resolved transitive dependencies, and maintainer identities, stored as a graph.
- **Register services** — declare what your services depend on; edges link each service to exact package versions.
- **Analyze** — given any version key (`npm:name@ver` / `pypi:name@ver`):
  - **Blast radius** — BFS over the dependency graph to find every service reachable from a compromised version, with hop counts.
  - **Attack paths** — shortest path from each affected service to the compromised version.
  - **Risk scoring** — per-service and per-package scores (production exposure weighted highest) mapped to CRITICAL / HIGH / MEDIUM / LOW.
  - **Co-maintainers** — other packages sharing maintainers with the target (compromise propagation surface).
  - **Typosquat detection** — Levenshtein-distance candidates against all known package names.
  - **Lockfile resolution** — given a compromised version and lockfile entries, report exactly which entries resolve to it and which services are hit.

### Graph model

```
(:Package)-[:HAS_VERSION]->(:Version)-[:DEPENDS_ON]->(:Version)
(:Service)-[:DEPENDS_ON_VERSION]->(:Version)
(:Maintainer)-[:MAINTAINS]->(:Package)
```

All vertex IDs are deterministic FNV-1a hashes of keys like `version:npm:axios@1.7.2`, so re-ingestion merges idempotently.

## Quickstart

### 1. Start HydraDB

```bash
docker pull ghcr.io/hydra-db/hydradb:latest

export HYDRA_TOKEN=$(openssl rand -hex 32)

docker run -d --name hydradb \
  -p 8443:8443 -p 7687:7687 \
  -e CLOUD_PROVIDER=local \
  -e LOCAL_PATH=/data/store \
  -e GRAPH_NAMESPACE=default \
  -e GRAPH_ID=default \
  -e GRAPH_CELL_ID=cell-0 \
  -e GRAPH_CELLS=cell-0 \
  -e GRAPH_NODE_ID=node-0 \
  -e GRAPH_ALLOW_PLAINTEXT=true \
  -e GRAPH_AUTH_TOKEN=$HYDRA_TOKEN \
  -v "$(pwd)/hydradb-data:/data" \
  ghcr.io/hydra-db/hydradb:latest
```

Or build from source (see [`hydradb/DEVELOPMENT.md`](./hydradb/DEVELOPMENT.md)): `cd hydradb && docker build -t hydradb:local .`

### 2. Run the backend

```bash
cd backend
bun install

cat > .env <<EOF
HYDRA_URL=http://127.0.0.1:8443
HYDRA_TOKEN=$HYDRA_TOKEN
HYDRA_NAMESPACE=default
HYDRA_CELL_ID=cell-0
PORT=3001
EOF

bun run dev        # bun --watch src/server.ts
```

Seed some data:

```bash
bun run ingest axios 1.7.2 --depth 2      # crawl npm package into HydraDB
bun scripts/ingest-services.ts            # register demo services
```

### 3. Run the front-end

```bash
cd front-end
npm install
NEXT_PUBLIC_CHAINTRACE_API=http://localhost:3001 npm run dev   # http://localhost:3000
```

Console routes: `/console/services`, `/console/graph` (3D), `/console/analysis`, `/console/risk`, `/console/blast`, `/console/paths`, `/console/maintainers`, `/console/lockfile`, `/console/typosquat`.

### 4. Use the CLI

```bash
cd cli
bun install && bun run build       # → dist/chaintrace single binary

export CHAINTRACE_API_URL=http://localhost:3001

chaintrace check axios@1.7.2       # full analysis of one package
chaintrace scan --path . --depth 5 # analyze everything in your lockfile
chaintrace github login            # GitHub device-flow OAuth
```

Supported lockfiles: `bun.lock`, `bun.lockb`, `package-lock.json`, `npm-shrinkwrap.json`. (`pnpm-lock.yaml` / `yarn.lock` detected but parsers pending.)

## API overview

Base URL: `http://localhost:3001` · full reference in [`backend/API_DOCUMENTATION.md`](./backend/API_DOCUMENTATION.md)

| Method & Path | Purpose |
|---|---|
| `GET /health` | Health check |
| `GET /services` · `POST /services` | List / register services with pinned deps |
| `POST /lockfiles/resolve` | Match lockfile entries against a compromised version |
| `GET /packages/:name` | Known versions of a package |
| `GET /packages/:name/graph?depth=` | Multi-hop dependency graph |
| `GET /packages/:name/:version/ingest?depth=` | Crawl npm package + deps into HydraDB |
| `GET /packages/:name/:version/analysis?depth=` | Risk + blast radius + attack paths in one call |
| `GET /packages/:name/:version/risk?depth=` | Risk score & severity |
| `GET /versions/:key/dependencies` | Direct dependencies of a version key |
| `GET /versions/:key/blast-radius?depth=` | Affected services by hop count |
| `GET /versions/:key/attack-path?depth=` | Shortest compromise path per service |
| `GET /versions/:key/co-maintainers` | Shared-maintainer package overlap |
| `GET /typosquat/:name?threshold=` | Typosquat candidates by edit distance |
| `GET /pypi/:name/:version/ingest?depth=` | PyPI ingestion |

Version keys use the `npm:name@version` / `pypi:name@version` format.

## Environment variables

| Variable | Used by | Default | Notes |
|---|---|---|---|
| `HYDRA_TOKEN` | backend, HydraDB | — | Required. Generate: `openssl rand -hex 32` |
| `HYDRA_URL` | backend | `http://127.0.0.1:8443` | HydraDB HTTP query API |
| `HYDRA_NAMESPACE` | backend, HydraDB | `default` | Graph namespace |
| `HYDRA_CELL_ID` | backend, HydraDB | `cell-0` | Graph cell |
| `PORT` | backend | `3001` | API port |
| `NEXT_PUBLIC_CHAINTRACE_API` | front-end | `http://localhost:3001` | Build-time baked |
| `CHAINTRACE_API_URL` | CLI | `http://localhost:3001` | Backend base URL |
| `CHAINTRACE_DASHBOARD_URL` | CLI | `http://localhost:3000` | Link printed after scans |
| `GITHUB_CLIENT_ID` | CLI | — | For `chaintrace github login` (device flow) |

Copy `.env.example` at the root as a starting point.

## HydraDB

[`hydradb/`](./hydradb) is a full Rust workspace implementing the database ChainTrace runs on:

- **Object-store-native** — S3-compatible storage is the source of truth; local disk/RAM are caches (built on SlateDB).
- **OpenCypher subset** via `libcypher-parser`, TCK-tested; **Neo4j-compatible Bolt 5.1–5.4** on port 7687.
- **HTTP JSON/NDJSON query API** on 8443 (Bearer auth + `X-Graph-Namespace` header).
- **GraphBLAS** (SuiteSparse) traversal kernels, CSC index generations built async by `graph-indexer`.
- **Cells & placement** — rendezvous hashing, writer leases/fencing, multigraph support.
- Helm chart, Grafana dashboards, Prometheus metrics, OTLP telemetry included.

Ports: `8443` HTTP API · `7687` Bolt · `9090` admin (`/readyz`, `/metrics`). License: AGPL-3.0.

## Development

```bash
# Backend
cd backend && bun install && bun run dev

# CLI
cd cli && bun install && bun run dev

# Front-end
cd front-end && npm install && npm run dev

# HydraDB (uses just, not bare cargo)
cd hydradb && just native-check && just test && just ci
```

Deployment guide (production architecture, Docker Compose, TLS, backups): [`DEPLOYMENT.md`](./DEPLOYMENT.md).
