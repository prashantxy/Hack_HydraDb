# ChainTrace Backend API Reference

> **Complete API documentation for front-end integration.**
> Base URL: `http://localhost:3000` (default)
> Content-Type: `application/json` for all responses.

---

## Table of Contents

1. [Overview](#overview)
2. [CORS](#cors)
3. [Error Format](#error-format)
4. [Endpoints](#endpoints)
   - [GET /health](#get-health)
   - [POST /services](#post-services)
   - [GET /services](#get-services)
   - [GET /packages/:packageName](#get-packagespackagename)
   - [GET /packages/:packageName/graph](#get-packagespackagenamegraph)
   - [GET /packages/:packageName/:version/ingest](#get-packagespackagenameversioningest)
   - [GET /packages/:packageName/:version/analysis](#get-packagespackagenameversionanalysis)
   - [GET /packages/:packageName/:version/risk](#get-packagespackagenameversionrisk)
   - [GET /versions/:versionKey/dependencies](#get-versionsversionkeydependencies)
   - [GET /versions/:versionKey/blast-radius](#get-versionsversionkeyblast-radius)
   - [GET /versions/:versionKey/risk](#get-versionsversionkeyrisk)
   - [GET /versions/:versionKey/attack-path](#get-versionsversionkeyattack-path)
5. [Data Types](#data-types)

---

## Overview

ChainTrace is a software supply-chain security platform. This API powers:

- **Package ingestion** — crawling npm packages and building a dependency graph
- **Blast radius** — finding which services are affected by a vulnerable package
- **Risk scoring** — calculating a 0–100 severity score
- **Attack path analysis** — finding the shortest path from a service to a compromised dependency
- **Service registration** — registering services and their dependencies

### Version Key Format

Most endpoints accept a `versionKey` in the format:

```
npm:<packageName>@<version>
```

Example: `npm:axios@1.7.2`

---

## CORS

All responses include:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

A preflight `OPTIONS` request returns `204 No Content`.

---

## Error Format

All errors return:

```json
{
  "error": "Human-readable error message"
}
```

Common HTTP status codes:

| Status | Meaning |
|--------|---------|
| `400` | Bad request (missing/invalid parameters) |
| `404` | Package or version not found in graph |
| `405` | HTTP method not allowed |
| `500` | Internal server error |

---

## Endpoints

---

### GET /health

Health check. No parameters.

#### Request

```
GET /health
```

#### Response — `200 OK`

```json
{
  "status": "ok",
  "service": "chaintrace"
}
```

#### cURL

```bash
curl http://localhost:3000/health
```

---

### POST /services

Register a service and its npm dependencies into the dependency graph.

#### Request

```
POST /services
Content-Type: application/json
```

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ✅ | Service name (e.g. `"payment-api"`) |
| `repo` | `string` | ❌ | Git repository URL. Defaults to `name`. |
| `team` | `string` | ❌ | Team that owns this service |
| `environment` | `string` | ❌ | `"production"`, `"staging"`, `"development"` (default) |
| `dependencies` | `Dependency[]` | ❌ | Array of npm dependencies the service uses |

**Dependency object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ✅ | npm package name (e.g. `"axios"`) |
| `version` | `string` | ✅ | Exact version (e.g. `"1.7.2"`) |

#### Request Example

```json
{
  "name": "payment-api",
  "repo": "https://github.com/myorg/payment-api",
  "team": "payments",
  "environment": "production",
  "dependencies": [
    { "name": "axios", "version": "1.7.2" },
    { "name": "express", "version": "4.18.2" }
  ]
}
```

#### Response — `200 OK`

```json
{
  "success": true,
  "serviceId": 1234567890,
  "dependencyCount": 2
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Always `true` on success |
| `serviceId` | `number` | Auto-generated unique service ID (FNV-1a hash) |
| `dependencyCount` | `number` | Number of dependency edges created |

#### Error Responses

| Status | Body |
|--------|------|
| `400` | `{ "error": "Service name is required" }` |
| `400` | `{ "error": "Invalid request body" }` |
| `500` | `{ "error": "Service registration failed" }` |

#### cURL

```bash
curl -X POST http://localhost:3000/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "payment-api",
    "team": "payments",
    "environment": "production",
    "dependencies": [
      { "name": "axios", "version": "1.7.2" }
    ]
  }'
```

---

### GET /services

List all registered services.

#### Request

```
GET /services
```

#### Response — `200 OK`

```json
{
  "success": true,
  "count": 3,
  "services": [
    {
      "id": 1234567890,
      "name": "payment-api",
      "repo": "payment-api",
      "team": "payments",
      "environment": "production"
    },
    {
      "id": 2345678901,
      "name": "checkout-service",
      "repo": "https://github.com/myorg/checkout",
      "team": "commerce",
      "environment": "production"
    },
    {
      "id": 3456789012,
      "name": "analytics-api",
      "repo": "analytics-api",
      "team": null,
      "environment": "staging"
    }
  ]
}
```

**Service object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Unique service ID |
| `name` | `string` | Service name |
| `repo` | `string` | Repository identifier |
| `team` | `string \| null` | Owning team |
| `environment` | `string \| null` | `"production"`, `"staging"`, `"development"`, or `null` |

#### cURL

```bash
curl http://localhost:3000/services
```

---

### GET /packages/:packageName

Get all known versions for an npm package.

#### Request

```
GET /packages/:packageName
```

| Param | Description |
|-------|-------------|
| `:packageName` | URL-encoded npm package name (e.g. `axios`, `@scope/pkg`) |

#### Response — `200 OK`

```json
{
  "name": "axios",
  "versions": [
    {
      "name": "axios",
      "key": "npm:axios@1.7.2",
      "version": "1.7.2"
    },
    {
      "name": "axios",
      "key": "npm:axios@1.6.8",
      "version": "1.6.8"
    }
  ]
}
```

**Version object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Package name |
| `key` | `string` | Full version key (format: `npm:<name>@<version>`) |
| `version` | `string` | Semver version string |

#### Error Responses

| Status | Body |
|--------|------|
| `400` | `{ "error": "Package name is required" }` |
| `404` | `{ "error": "Package 'axios' not found" }` |
| `500` | `{ "error": "Failed to query package" }` |

#### cURL

```bash
curl http://localhost:3000/packages/axios
```

---

### GET /packages/:packageName/graph

Get the full dependency graph for a package, traversing dependencies up to a given depth.

#### Request

```
GET /packages/:packageName/graph?depth=2
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `:packageName` | `string` | ✅ | — | URL-encoded npm package name |
| `?depth` | `integer` | ❌ | `1` | How many levels of transitive dependencies to traverse (1–5) |

#### Response — `200 OK`

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
    },
    {
      "id": "npm:follow-redirects@1.16.0",
      "packageName": "follow-redirects",
      "version": "1.16.0",
      "depth": 1
    },
    {
      "id": "npm:mime-types@2.1.35",
      "packageName": "mime-types",
      "version": "2.1.35",
      "depth": 2
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
    },
    {
      "source": "npm:axios@1.7.2",
      "target": "npm:follow-redirects@1.16.0",
      "packageName": "follow-redirects",
      "versionRange": "^1.15.0",
      "dependencyType": "runtime",
      "depth": 1
    },
    {
      "source": "npm:form-data@4.0.6",
      "target": "npm:mime-types@2.1.35",
      "packageName": "mime-types",
      "versionRange": "^2.1.26",
      "dependencyType": "runtime",
      "depth": 2
    }
  ]
}
```

**Node fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Full version key (e.g. `"npm:axios@1.7.2"`) |
| `packageName` | `string` | npm package name |
| `version` | `string` | Semver version |
| `depth` | `number` | Distance from root package (0 = root) |

**Edge fields:**

| Field | Type | Description |
|-------|------|-------------|
| `source` | `string` | Version key of the source node |
| `target` | `string` | Version key of the target node |
| `packageName` | `string` | Name of the dependency package |
| `versionRange` | `string` | Semver range (e.g. `"^4.0.0"`) |
| `dependencyType` | `string` | `"runtime"`, `"optional"`, or `"peer"` |
| `depth` | `number` | Depth level where this edge exists |

#### Error Responses

| Status | Body |
|--------|------|
| `400` | `{ "error": "Package name is required" }` |
| `404` | `{ "error": "Package 'unknown' not found" }` |
| `500` | `{ "error": "Failed to query package graph" }` |

#### cURL

```bash
curl "http://localhost:3000/packages/axios/graph?depth=2"
```

---

### GET /packages/:packageName/:version/ingest

Ingest (crawl) an npm package version and its transitive dependencies into the graph database. This populates the data needed for blast-radius, risk, and attack-path queries.

#### Request

```
GET /packages/:packageName/:version/ingest?depth=3
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `:packageName` | `string` | ✅ | — | npm package name |
| `:version` | `string` | ✅ | — | Exact semver version |
| `?depth` | `integer` | ❌ | `2` | Transitive dependency depth to crawl |

#### Response — `200 OK`

```json
{
  "success": true,
  "packageName": "axios",
  "version": "1.7.2",
  "versionKey": "npm:axios@1.7.2",
  "stats": {
    "packagesIngested": 12,
    "versionsProcessed": 15,
    "dependenciesCreated": 24,
    "errors": 0
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Always `true` on success |
| `packageName` | `string` | The ingested package name |
| `version` | `string` | The ingested version |
| `versionKey` | `string` | Full version key |
| `stats` | `object` | Ingestion statistics |
| `stats.packagesIngested` | `number` | Unique packages added to the graph |
| `stats.versionsProcessed` | `number` | Total versions processed |
| `stats.dependenciesCreated` | `number` | Total dependency edges created |
| `stats.errors` | `number` | Number of errors during crawl |

#### Error Responses

| Status | Body |
|--------|------|
| `400` | `{ "error": "Package name is required" }` |
| `400` | `{ "error": "Version is required" }` |
| `400` | `{ "error": "Depth must be a non-negative integer" }` |
| `500` | `{ "error": "Package ingestion failed" }` |

#### cURL

```bash
curl "http://localhost:3000/packages/axios/1.7.2/ingest?depth=3"
```

---

### GET /packages/:packageName/:version/analysis

**All-in-one endpoint.** Returns risk score, blast radius, and attack paths in a single call. This is the primary endpoint the front-end should use for the package detail view.

#### Request

```
GET /packages/:packageName/:version/analysis?depth=5
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `:packageName` | `string` | ✅ | — | npm package name |
| `:version` | `string` | ✅ | — | Exact semver version |
| `?depth` | `integer` | ❌ | `5` | BFS traversal depth (0–5) |

#### Response — `200 OK`

```json
{
  "packageName": "axios",
  "version": "1.7.2",
  "versionKey": "npm:axios@1.7.2",
  "maxDepth": 5,

  "risk": {
    "version": "npm:axios@1.7.2",
    "score": 90,
    "severity": "CRITICAL",
    "affectedServices": 3,
    "productionServices": 2,
    "services": [
      {
        "serviceId": 1234567890,
        "name": "payment-api",
        "environment": "production",
        "hops": 0,
        "score": 90,
        "severity": "CRITICAL",
        "reasons": [
          "Affected production service",
          "Direct dependency"
        ]
      },
      {
        "serviceId": 2345678901,
        "name": "checkout-service",
        "environment": "production",
        "hops": 1,
        "score": 80,
        "severity": "CRITICAL",
        "reasons": [
          "Affected production service",
          "One-hop transitive dependency"
        ]
      },
      {
        "serviceId": 3456789012,
        "name": "analytics-api",
        "environment": "staging",
        "hops": 2,
        "score": 40,
        "severity": "MEDIUM",
        "reasons": [
          "Affected staging service",
          "2-hop transitive dependency"
        ]
      }
    ]
  },

  "blastRadius": {
    "affectedServices": 3,
    "productionServices": 2,
    "services": [
      {
        "id": 1234567890,
        "name": "payment-api",
        "repo": "https://github.com/myorg/payment-api",
        "team": "payments",
        "environment": "production",
        "hops": 0
      },
      {
        "id": 2345678901,
        "name": "checkout-service",
        "repo": "checkout-service",
        "team": "commerce",
        "environment": "production",
        "hops": 1
      },
      {
        "id": 3456789012,
        "name": "analytics-api",
        "repo": "analytics-api",
        "team": null,
        "environment": "staging",
        "hops": 2
      }
    ]
  },

  "attackPaths": {
    "affectedServices": 3,
    "paths": [
      {
        "serviceId": 1234567890,
        "serviceName": "payment-api",
        "environment": "production",
        "hops": 0,
        "path": [
          "npm:axios@1.7.2"
        ]
      },
      {
        "serviceId": 2345678901,
        "serviceName": "checkout-service",
        "environment": "production",
        "hops": 1,
        "path": [
          "npm:form-data@4.0.6",
          "npm:axios@1.7.2"
        ]
      },
      {
        "serviceId": 3456789012,
        "serviceName": "analytics-api",
        "environment": "staging",
        "hops": 2,
        "path": [
          "npm:mime-types@2.1.35",
          "npm:form-data@4.0.6",
          "npm:axios@1.7.2"
        ]
      }
    ]
  }
}
```

#### Error Responses

| Status | Body |
|--------|------|
| `400` | `{ "error": "Expected /packages/:packageName/:version/analysis" }` |
| `400` | `{ "error": "Invalid npm version key: ..." }` |
| `400` | `{ "error": "Unsupported version key: ..." }` |
| `404` | `{ "error": "Version not found: npm:axios@9.9.9" }` |
| `500` | `{ "error": "Failed to calculate security analysis" }` |

#### cURL

```bash
curl "http://localhost:3000/packages/axios/1.7.2/analysis?depth=5"
```

---

### GET /packages/:packageName/:version/risk

Get the risk score for a specific package version. Returns a 0–100 score with severity level and per-service breakdown.

#### Request

```
GET /packages/:packageName/:version/risk?depth=5
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `:packageName` | `string` | ✅ | — | npm package name |
| `:version` | `string` | ✅ | — | Exact semver version |
| `?depth` | `integer` | ❌ | `5` | BFS traversal depth |

#### Response — `200 OK`

```json
{
  "version": "npm:axios@1.7.2",
  "score": 90,
  "severity": "CRITICAL",
  "affectedServices": 3,
  "productionServices": 2,
  "maxDepth": 5,
  "services": [
    {
      "serviceId": 1234567890,
      "name": "payment-api",
      "environment": "production",
      "hops": 0,
      "score": 90,
      "severity": "CRITICAL",
      "reasons": [
        "Affected production service",
        "Direct dependency"
      ]
    }
  ]
}
```

**Top-level fields:**

| Field | Type | Description |
|-------|------|-------------|
| `version` | `string` | Full version key |
| `score` | `number` | Overall risk score (0–100) |
| `severity` | `string` | `"CRITICAL"` (≥80), `"HIGH"` (≥60), `"MEDIUM"` (≥30), `"LOW"` (<30) |
| `affectedServices` | `number` | Total number of services in blast radius |
| `productionServices` | `number` | Number of production services affected |
| `maxDepth` | `number` | The depth used for this calculation |

**Service risk fields:**

| Field | Type | Description |
|-------|------|-------------|
| `serviceId` | `number` | Unique service ID |
| `name` | `string` | Service name |
| `environment` | `string \| null` | `"production"`, `"staging"`, etc. |
| `hops` | `number` | Hops from service to vulnerable package (0 = direct) |
| `score` | `number` | Per-service risk score (0–100) |
| `severity` | `string` | Per-service severity level |
| `reasons` | `string[]` | Human-readable reasons for the score |

**Scoring logic:**

| Factor | Points |
|--------|--------|
| Production environment | +60 |
| Staging environment | +30 |
| Non-production environment | +10 |
| Direct dependency (0 hops) | +30 |
| 1-hop transitive | +20 |
| 2–3 hop transitive | +10 |

**Package-level bonus:** +10 if ≥2 production services, +10 if ≥5 production services.

#### cURL

```bash
curl "http://localhost:3000/packages/axios/1.7.2/risk?depth=5"
```

---

### GET /versions/:versionKey/dependencies

List all direct dependencies for a given version key.

#### Request

```
GET /versions/:versionKey/dependencies
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `:versionKey` | `string` | ✅ | URL-encoded version key (e.g. `npm:axios@1.7.2`) |

#### Response — `200 OK`

```json
{
  "version": "npm:axios@1.7.2",
  "dependencies": [
    {
      "source": "npm:axios@1.7.2",
      "packageName": "form-data",
      "versionRange": "^4.0.0",
      "dependencyType": "runtime",
      "target": "npm:form-data@4.0.6"
    },
    {
      "source": "npm:axios@1.7.2",
      "packageName": "follow-redirects",
      "versionRange": "^1.15.0",
      "dependencyType": "runtime",
      "target": "npm:follow-redirects@1.16.0"
    }
  ]
}
```

**Dependency object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `source` | `string` | Version key of the dependency owner |
| `packageName` | `string` | Name of the dependency |
| `versionRange` | `string` | Semver range requested (e.g. `"^4.0.0"`) |
| `dependencyType` | `string` | `"runtime"`, `"optional"`, or `"peer"` |
| `target` | `string` | Resolved version key of the dependency |

#### cURL

```bash
curl "http://localhost:3000/versions/npm:axios@1.7.2/dependencies"
```

---

### GET /versions/:versionKey/blast-radius

Find all services affected by a vulnerable package version. Uses BFS traversal through the dependency graph.

#### Request

```
GET /versions/:versionKey/blast-radius?depth=5
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `:versionKey` | `string` | ✅ | — | URL-encoded version key |
| `?depth` | `integer` | ❌ | `5` | Maximum BFS depth |

#### Response — `200 OK`

```json
{
  "version": "npm:axios@1.7.2",
  "maxDepth": 5,
  "affectedServices": 3,
  "services": [
    {
      "id": 1234567890,
      "name": "payment-api",
      "repo": "https://github.com/myorg/payment-api",
      "team": "payments",
      "environment": "production",
      "hops": 0
    },
    {
      "id": 2345678901,
      "name": "checkout-service",
      "repo": "checkout-service",
      "team": "commerce",
      "environment": "production",
      "hops": 1
    },
    {
      "id": 3456789012,
      "name": "analytics-api",
      "repo": "analytics-api",
      "team": null,
      "environment": "staging",
      "hops": 2
    }
  ]
}
```

**Service fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Unique service ID |
| `name` | `string` | Service name |
| `repo` | `string` | Repository identifier |
| `team` | `string \| null` | Owning team |
| `environment` | `string \| null` | `"production"`, `"staging"`, `"development"`, or `null` |
| `hops` | `number` | Shortest path from service to vulnerable package |

Results are sorted by `hops` (ascending), then alphabetically by `name`.

#### cURL

```bash
curl "http://localhost:3000/versions/npm:axios@1.7.2/blast-radius?depth=5"
```

---

### GET /versions/:versionKey/risk

Calculate risk score for a version key. Same data as the `/packages/:packageName/:version/risk` endpoint but accepts a version key directly.

#### Request

```
GET /versions/:versionKey/risk?depth=5
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `:versionKey` | `string` | ✅ | — | URL-encoded version key |
| `?depth` | `integer` | ❌ | `5` | BFS traversal depth |

#### Response — `200 OK`

```json
{
  "version": "npm:axios@1.7.2",
  "score": 90,
  "severity": "CRITICAL",
  "affectedServices": 3,
  "productionServices": 2,
  "services": [
    {
      "serviceId": 1234567890,
      "name": "payment-api",
      "environment": "production",
      "hops": 0,
      "score": 90,
      "severity": "CRITICAL",
      "reasons": [
        "Affected production service",
        "Direct dependency"
      ]
    }
  ],
  "maxDepth": 5
}
```

> See [GET /packages/:packageName/:version/risk](#get-packagespackagenameversionrisk) for full field descriptions.

#### cURL

```bash
curl "http://localhost:3000/versions/npm:axios@1.7.2/risk?depth=5"
```

---

### GET /versions/:versionKey/attack-path

Find the shortest path from each affected service to the vulnerable package version. Useful for visualizing the attack surface.

#### Request

```
GET /versions/:versionKey/attack-path?depth=5
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `:versionKey` | `string` | ✅ | — | URL-encoded version key |
| `?depth` | `integer` | ❌ | `5` | Maximum BFS depth |

#### Response — `200 OK`

```json
{
  "version": "npm:axios@1.7.2",
  "maxDepth": 5,
  "affectedServices": 3,
  "attackPaths": [
    {
      "serviceId": 1234567890,
      "serviceName": "payment-api",
      "environment": "production",
      "hops": 0,
      "path": [
        "npm:axios@1.7.2"
      ]
    },
    {
      "serviceId": 2345678901,
      "serviceName": "checkout-service",
      "environment": "production",
      "hops": 1,
      "path": [
        "npm:form-data@4.0.6",
        "npm:axios@1.7.2"
      ]
    },
    {
      "serviceId": 3456789012,
      "serviceName": "analytics-api",
      "environment": "staging",
      "hops": 2,
      "path": [
        "npm:mime-types@2.1.35",
        "npm:form-data@4.0.6",
        "npm:axios@1.7.2"
      ]
    }
  ]
}
```

**AttackPath object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `serviceId` | `number` | Unique service ID |
| `serviceName` | `string` | Service name |
| `environment` | `string \| null` | Service environment |
| `hops` | `number` | Number of dependency hops to the vulnerable package |
| `path` | `string[]` | Ordered list of version keys from service's dependency to the vulnerable package. First element is the service's direct dependency, last element is the vulnerable package. |

Results are sorted by `hops` (ascending), then alphabetically by `serviceName`.

#### cURL

```bash
curl "http://localhost:3000/versions/npm:axios@1.7.2/attack-path?depth=5"
```

---

## Data Types

### Version Key Format

```
npm:<packageName>@<version>
```

Examples:
- `npm:axios@1.7.2`
- `npm:follow-redirects@1.16.0`
- `npm:@scope/package@1.0.0`

### Risk Severity

| Severity | Score Range | Description |
|----------|-------------|-------------|
| `CRITICAL` | 80–100 | Direct dependency in production |
| `HIGH` | 60–79 | Production service affected, transitive |
| `MEDIUM` | 30–59 | Staging or deep transitive |
| `LOW` | 0–29 | Non-production, few hops |

### Dependency Types

| Type | Description |
|------|-------------|
| `runtime` | Required in production code |
| `optional` | May be installed based on configuration |
| `peer` | Expected to be provided by the consumer |

### Environment Values

| Value | Description |
|-------|-------------|
| `production` | Live production environment |
| `staging` | Pre-production / staging |
| `development` | Local / development (default) |
| `null` | Unknown or not specified |

---

## Typical Front-End Flow

```
1. User types a package name
   → GET /packages/:packageName
   → Shows available versions

2. User selects a version
   → GET /packages/:packageName/:version/ingest?depth=3
   → Ingests the dependency graph

3. User views analysis
   → GET /packages/:packageName/:version/analysis?depth=5
   → Displays risk score, blast radius, attack paths

4. Service registration (from CLI or CI/CD)
   → POST /services
   → Registers a service with its dependencies

5. View all services
   → GET /services
   → Lists registered services
```

---

## Graph Data Model

The backend stores a property graph in Hydra (graph database):

```
Package ──[:HAS_VERSION]──▶ Version
                                │
                          [:DEPENDS_ON]
                                │
                                ▼
                            Version

Service ──[:DEPENDS_ON_VERSION]──▶ Version
```

**Node properties:**

| Label | Property | Type | Description |
|-------|----------|------|-------------|
| `Package` | `name` | `string` | npm package name |
| `Version` | `id` | `number` | Unique version ID |
| `Version` | `key` | `string` | Version key (`npm:name@version`) |
| `Version` | `packageName` | `string` | Package name |
| `Version` | `version` | `string` | Semver version |
| `Service` | `id` | `number` | Unique service ID |
| `Service` | `name` | `string` | Service name |
| `Service` | `repo` | `string` | Repository |
| `Service` | `team` | `string?` | Owning team |
| `Service` | `environment` | `string?` | Environment |

**Edge properties:**

| Relationship | Property | Type | Description |
|-------------|----------|------|-------------|
| `DEPENDS_ON` | `packageName` | `string` | Dependency name |
| `DEPENDS_ON` | `versionRange` | `string` | Semver range |
| `DEPENDS_ON` | `dependencyType` | `string` | `runtime` / `optional` / `peer` |
