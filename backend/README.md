# ChainTrace Backend

ChainTrace is a backend service for building, storing, querying, and analyzing npm package dependency graphs.

It fetches package metadata from the npm registry, normalizes package/version/dependency information, stores the resulting graph in **HydraDB**, and exposes HTTP APIs for querying package versions, dependencies, and multi-hop dependency graphs.

```
npm Registry
     ↓
Fetch metadata
     ↓
Normalize package data
     ↓
Resolve dependency versions
     ↓
Build graph
     ↓
HydraDB
     ↓
Graph Queries
     ↓
Graph Service
     ↓
HTTP API
```

## Technology Stack

| Component              | Technology       |
|-------------------------|------------------|
| Runtime                 | Bun              |
| Language                 | TypeScript       |
| Package Registry         | npm Registry     |
| Graph Database           | HydraDB          |
| Query Language           | OpenCypher       |
| HTTP                     | Bun Request/Response APIs |
| Dependency Resolution    | semver           |
| Configuration            | dotenv           |

## Project Structure

```
src/
├── api/
│   ├── router.ts
│   ├── response.ts
│   └── routes/
│       ├── health.ts
│       ├── packages.ts
│       ├── versions.ts
│       └── graph.ts
│
├── graph/
│   ├── query/
│   │   ├── package.ts
│   │   ├── dependency.ts
│   │   └── graph.ts
│   │
│   ├── packages.ts
│   ├── dependencies.ts
│   └── graph-service.ts
│
├── hydra/
│   └── client.ts
│
├── registry/
│   ├── registry.ts
│   ├── normalize.ts
│   └── resolver.ts
│
└── server.ts
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) runtime
- A running HydraDB instance

### Environment Configuration

Create a `.env` file with:

```
HYDRA_URL=http://127.0.0.1:8443
HYDRA_TOKEN=your-token
HYDRA_NAMESPACE=default
HYDRA_CELL_ID=cell-0
```

| Variable          | Required | Default   |
|--------------------|----------|-----------|
| `HYDRA_URL`         | Yes      | —         |
| `HYDRA_TOKEN`       | Yes      | —         |
| `HYDRA_NAMESPACE`   | No       | `default` |
| `HYDRA_CELL_ID`     | No       | `cell-0`  |

The application fails immediately at startup if `HYDRA_URL` or `HYDRA_TOKEN` is missing.

### Running

```bash
bun install
bun run src/server.ts
```

## HydraDB Client

**File:** `src/hydra/client.ts`

The main entry point is:

```ts
hydraQuery(
  query: string,
  options?: HydraQueryOptions
): Promise<HydraQueryResult>
```

It sends a `POST /v1/graphs/{namespace}/query` request with:

```
Authorization: Bearer <token>
X-Graph-Namespace: <namespace>
Content-Type: application/json
```

Request body:

```json
{
  "cell_id": "cell-0",
  "query": "...",
  "parameters": {}
}
```

### Response Model

Hydra returns typed cells:

```json
{ "type": "string", "value": "axios" }
```

Example query result:

```json
{
  "query_id": "http-query-83",
  "columns": ["id", "key", "packageName", "version"],
  "rows": [
    [
      { "type": "vertex_id", "value": 2558837201 },
      { "type": "string", "value": "npm:axios@1.7.2" }
    ]
  ],
  "read_epoch": 26,
  "next_cursor": null
}
```

The graph service is responsible for converting these raw Hydra values into plain TypeScript objects.

## Graph Data Model

ChainTrace uses four primary concepts.

### `Package`

Properties: `id`, `name`, `ecosystem`

```
Package
name = axios
ecosystem = npm
```

### `Version`

Properties: `id`, `key`, `packageName`, `version`, `ecosystem`

```
Version
key = npm:axios@1.7.2
packageName = axios
version = 1.7.2
ecosystem = npm
```

### `HAS_VERSION`

`(:Package)-[:HAS_VERSION]->(:Version)`

```
axios
  │
  └── HAS_VERSION
          │
          ▼
     axios@1.7.2
```

### `DEPENDS_ON`

`(:Version)-[:DEPENDS_ON]->(:Version)`

Properties: `id`, `packageName`, `versionRange`, `dependencyType`

```
axios@1.7.2
      │
      └── DEPENDS_ON
             │
             ▼
       form-data@4.0.6
```

## Graph Writes

### Package Graph Writes — `src/graph/packages.ts`

- **`upsertPackages()`** — creates or updates `Package` vertices.
- **`upsertVersions()`** — creates or updates `Version` vertices.
- **`createPackageVersionEdges()`** — creates `Package → Version` (`HAS_VERSION`) edges.

### Dependency Graph Writes — `src/graph/dependencies.ts`

- **`createDependencyEdges(edges)`** — creates `DEPENDS_ON` relationships between versions. Uses `MERGE` on relationship `id` to prevent duplicate edges.

## Registry Layer

```
src/registry/
├── registry.ts
├── normalize.ts
└── resolver.ts
```

- **`registry.ts`** — fetches raw metadata from `registry.npmjs.org`. The raw response is not stored directly in Hydra.
- **`normalize.ts`** — converts npm metadata into ChainTrace's internal `NormalizedPackageVersion` representation, categorizing dependencies into `runtime`, `optional`, and `peer`, and generating a stable key such as `npm:axios@1.7.2`.
- **`resolver.ts`** — resolves a semver range (e.g. `^1.15.0`) to a concrete compatible version (e.g. `1.16.0`), connecting dependency ranges to actual `Version` vertices.

## Graph Query Layer

**Location:** `src/graph/query/`

Contains application-specific OpenCypher queries. This layer has no HTTP concerns.

- **`getPackageVersions(packageName)`** — returns all versions of a package.
- **`getDependencies(versionKey)`** — returns the direct dependencies of a version.

### Graph Traversal — `src/graph/query/graph.ts`

Provides:

- `getPackageVersionKeys()`
- `getVersionDependencies()`

Traversal is performed level-by-level rather than relying on a variable-length Cypher path (`DEPENDS_ON*1..5`), since this works better with the current Hydra OpenCypher implementation:

```
Depth 0
  axios

Depth 1
  form-data
  follow-redirects
  proxy-from-env

Depth 2
  dependencies of those packages
```

## Graph Service

**File:** `src/graph/graph-service.ts`

Sits between the graph query layer and HTTP routes.

Current functions: `packageInfo()`, `packageDependencies()`, `packageGraph()`

```
HTTP Route
    ↓
Graph Service
    ↓
Graph Query
    ↓
hydraQuery()
    ↓
HydraDB
```

## HTTP API

### `GET /health`

Health check.

```bash
curl "http://localhost:3000/health"
```

### `GET /packages/:packageName`

Returns package information and versions.

```bash
curl "http://localhost:3000/packages/axios"
```

### `GET /versions/:versionKey/dependencies`

Returns dependencies for a specific version.

```bash
curl "http://localhost:3000/versions/npm%3Aaxios%401.7.2/dependencies"
```

### `GET /packages/:packageName/graph`

Returns a dependency graph. Supports a `depth` query parameter (`1`–`5`, max `5`).

```bash
curl "http://localhost:3000/packages/axios/graph?depth=2"
```

Example response:

```json
{
  "package": "axios",
  "depth": 2,
  "nodes": [
    {
      "id": "npm:axios@1.7.2",
      "packageName": "axios",
      "version": "1.7.2",
      "depth": 0
    },
    {
      "id": "npm:form-data@4.0.6",
      "packageName": "form-data",
      "version": "4.0.6",
      "depth": 1
    }
  ],
  "edges": [
    {
      "source": "npm:axios@1.7.2",
      "target": "npm:form-data@4.0.6",
      "packageName": "form-data",
      "versionRange": "^4.0.0",
      "dependencyType": "runtime",
      "depth": 1
    }
  ]
}
```

## Router

**File:** `src/api/router.ts`

```
GET /health                                → healthRoute()
GET /packages/:packageName                 → packageRoute()
GET /packages/:packageName/graph           → graphRoute()
GET /versions/:versionKey/dependencies     → versionDependenciesRoute()
```

The graph route is matched before the generic package route, so that `/packages/axios/graph` is not misinterpreted as `packageName = "axios/graph"`.

## Error Handling

The API returns:

- `400 Bad Request`
- `405 Method Not Allowed`
- `404 Not Found`
- `500 Internal Server Error`

Depth validation rules:

- `depth >= 1`
- `depth <= 5`
- `depth` must be an integer

```bash
GET /packages/axios/graph?depth=100
```

returns an error rather than executing an unrestricted traversal.

## CORS

Preflight `OPTIONS` requests are supported with:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Current Dataset & Limitation

Hydra currently contains one dependency level for `axios`:

```
axios@1.7.2
├── form-data@4.0.6
├── follow-redirects@1.16.0
└── proxy-from-env@1.1.0
```

The graph API supports multi-hop traversal, but ingestion currently only populates direct (depth-1) dependencies. As a result, `depth=1` and `depth=2` currently return the same graph — Hydra has no second-level relationships (e.g. `form-data → dependency`) yet. The traversal implementation itself is ready for deeper graphs once ingestion catches up.

## Roadmap

### Next major task: Recursive Dependency Ingestion

Evolve ingestion from direct dependencies only to full transitive ingestion:

```
Package
   ↓
Dependencies
   ↓
Dependencies of dependencies
   ↓
Dependencies of dependencies of dependencies
```

Recommended design:

```ts
ingestPackage(package, version, depth)
```

with a `visited: Set<string>` to prevent re-processing the same package/version, and a configurable maximum depth.

### Future Backend Features

- **Dependency impact analysis** — `GET /packages/:packageName/impact`, determining which packages depend on a given package.
- **Circular dependency detection** — detect cycles such as `A → B → C → A`.
- **Dependency statistics** — direct/transitive dependency counts, dependents, graph depth.
- **Caching** — npm metadata, resolved versions, frequently requested graphs.
- **Pagination** — for large dependency graphs.
- **Vulnerability/risk analysis** — potential integration with npm/GitHub security data.

## Architecture Summary

```
                    npm Registry
                         │
                         ▼
                Registry Fetcher
                         │
                         ▼
                    Normalizer
                         │
                         ▼
                  Version Resolver
                         │
                         ▼
                  Graph Ingestion
                         │
                         ▼
                      HydraDB
                         │
             ┌───────────┴───────────┐
             │                       │
         Packages                 Versions
             │                       │
             └──────HAS_VERSION──────┘
                                     │
                               DEPENDS_ON
                                     │
                                     ▼
                                  Versions
                                     │
                                     ▼
                               Graph Queries
                                     │
                                     ▼
                               Graph Service
                                     │
                                     ▼
                                  HTTP API
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
        Package API            Dependency API          Graph API
```

## Status

### Completed
- HydraDB integration & authentication
- Environment configuration
- Parameterized queries
- Package / Version vertices
- `HAS_VERSION` / `DEPENDS_ON` relationships
- npm metadata fetching, normalization, version resolution
- Graph query layer & graph service
- Hydra value handling
- HTTP server: Health, Package, Dependency, and Graph APIs
- Graph depth parameter & validation
- CORS

### In Progress / Remaining
- Recursive dependency ingestion
- Larger multi-hop graph data
- Graph impact analysis
- Circular dependency detection
- Caching
- Pagination
- Production observability
- Frontend visualization

---

The ChainTrace backend core is operational end-to-end (npm Registry → Normalize → HydraDB → OpenCypher → Graph Query Layer → Graph Service → HTTP API). The primary remaining milestone is **recursive ingestion**, which will allow the existing depth-aware graph API to return genuine multi-hop dependency graphs and unlock the interactive ChainTrace visualization and higher-level dependency intelligence features.