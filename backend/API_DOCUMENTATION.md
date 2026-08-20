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
   - [GET /versions/:versionKey/co-maintainers](#get-versionsversionkeyco-maintainers)
   - [POST /lockfiles/resolve](#post-lockfilesresolve)
   - [GET /typosquat/:packageName](#get-typosquatpackagename)
   - [GET /pypi/:packageName/:version/ingest](#get-pypipackagenameversioningest)
5. [Data Types](#data-types)

---

## Overview

ChainTrace is a software supply-chain security platform supporting both **npm** and **PyPI** ecosystems. This API powers:

- **Package ingestion** — crawling npm/PyPI packages and building a dependency graph
- **Blast radius** — finding which services are affected by a vulnerable package
- **Risk scoring** — calculating a 0–100 severity score
- **Attack path analysis** — finding the shortest path from a service to a compromised dependency
- **Co-maintainer analysis** — finding packages sharing maintainers with a compromised package
- **Lockfile resolution** — checking which lockfile entries resolved to a compromised version
- **Typosquat detection** — finding package names similar to a target (potential typosquats)
- **Service registration** — registering services and their dependencies

### Version Key Format

Endpoints accept a `versionKey` in the format:

```
npm:<packageName>@<version>     # for npm packages
pypi:<packageName>@<version>    # for PyPI packages
```

Examples: `npm:axios@1.7.2`, `pypi:requests@2.32.3`

### Graph Model

```
Package ──[:HAS_VERSION]──▶ Version ──[:DEPENDS_ON]──▶ Version
                                    ▲
Service ──[:DEPENDS_ON_VERSION]─────┘
Maintainer ──[:MAINTAINS]──▶ Package
```

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
      "id": 278169593,
      "name": "checkout-service",
      "repo": "company/checkout-service",
      "team": "commerce",
      "environment": "production"
    },
    {
      "id": 2076504302,
      "name": "payment-api",
      "repo": "company/payment-api",
      "team": "payments",
      "environment": "production"
    },
    {
      "id": 2451995120,
      "name": "analytics-api",
      "repo": "company/analytics-api",
      "team": "data",
      "environment": "production"
    }
  ]
}
```

#### cURL

```bash
curl http://localhost:3000/services
```

---

### GET /packages/:packageName

Get all known versions for a package.

#### Request

```
GET /packages/:packageName
```

| Param | Description |
|-------|-------------|
| `:packageName` | URL-encoded package name (e.g. `axios`, `@scope/pkg`) |

#### Response — `200 OK`

```json
{
  "name": "axios",
  "versions": [
    {
      "name": "axios",
      "key": "npm:axios@1.7.2",
      "version": "1.7.2"
    }
  ]
}
```

#### cURL

```bash
curl http://localhost:3000/packages/axios
```

---

### GET /packages/:packageName/graph

Get the dependency graph for a package, traversing dependencies up to a given depth.

#### Request

```
GET /packages/:packageName/graph?depth=2
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `:packageName` | `string` | ✅ | — | URL-encoded package name |
| `?depth` | `integer` | ❌ | `1` | Transitive dependency depth (1–5) |

#### Response — `200 OK`

```json
{
  "package": "axios",
  "depth": 1,
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
      "id": "npm:proxy-from-env@1.1.0",
      "packageName": "proxy-from-env",
      "version": "1.1.0",
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
    },
    {
      "source": "npm:axios@1.7.2",
      "target": "npm:follow-redirects@1.16.0",
      "packageName": "follow-redirects",
      "versionRange": "^1.15.6",
      "dependencyType": "runtime",
      "depth": 1
    }
  ]
}
```

#### cURL

```bash
curl "http://localhost:3000/packages/axios/graph?depth=1"
```

---

### GET /packages/:packageName/:version/ingest

Ingest (crawl) a package version and its transitive dependencies into the graph database.

#### Request

```
GET /packages/:packageName/:version/ingest?depth=3
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `:packageName` | `string` | ✅ | — | Package name |
| `:version` | `string` | ✅ | — | Exact version |
| `?depth` | `integer` | ❌ | `2` | Transitive dependency depth to crawl |

#### Response — `200 OK`

```json
{
  "success": true,
  "packageName": "axios",
  "version": "1.7.2",
  "versionKey": "npm:axios@1.7.2",
  "stats": {
    "packages": 12,
    "versions": 15,
    "dependencyEdges": 24,
    "packageVersionEdges": 15,
    "maintainers": 4,
    "maintainsEdges": 4,
    "processedNodes": 15,
    "skippedNodes": 0,
    "failedNodes": 0,
    "maxDepth": 3
  }
}
```

#### cURL

```bash
curl "http://localhost:3000/packages/axios/1.7.2/ingest?depth=3"
```

---

### GET /packages/:packageName/:version/analysis

**All-in-one endpoint.** Returns risk score, blast radius, and attack paths in a single call.

#### Request

```
GET /packages/:packageName/:version/analysis?depth=5
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `:packageName` | `string` | ✅ | — | Package name |
| `:version` | `string` | ✅ | — | Exact version |
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
    "affectedServices": 1,
    "productionServices": 1,
    "services": [
      {
        "serviceId": 2076504302,
        "name": "payment-api",
        "environment": "production",
        "hops": 0,
        "score": 90,
        "severity": "CRITICAL",
        "reasons": ["Affected production service", "Direct dependency"]
      }
    ]
  },
  "blastRadius": {
    "affectedServices": 1,
    "productionServices": 1,
    "services": [
      {
        "id": 2076504302,
        "name": "payment-api",
        "repo": "company/payment-api",
        "team": "payments",
        "environment": "production",
        "hops": 0
      }
    ]
  },
  "attackPaths": {
    "affectedServices": 1,
    "paths": [
      {
        "serviceId": 2076504302,
        "serviceName": "payment-api",
        "environment": "production",
        "hops": 0,
        "path": ["npm:axios@1.7.2"]
      }
    ]
  }
}
```

#### cURL

```bash
curl "http://localhost:3000/packages/axios/1.7.2/analysis?depth=5"
```

---

### GET /packages/:packageName/:version/risk

Get the risk score for a specific package version.

#### Request

```
GET /packages/:packageName/:version/risk?depth=5
```

#### Response — `200 OK`

```json
{
  "version": "npm:axios@1.7.2",
  "score": 90,
  "severity": "CRITICAL",
  "affectedServices": 1,
  "productionServices": 1,
  "maxDepth": 5,
  "services": [
    {
      "serviceId": 2076504302,
      "name": "payment-api",
      "environment": "production",
      "hops": 0,
      "score": 90,
      "severity": "CRITICAL",
      "reasons": ["Affected production service", "Direct dependency"]
    }
  ]
}
```

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
      "versionRange": "^1.15.6",
      "dependencyType": "runtime",
      "target": "npm:follow-redirects@1.16.0"
    }
  ]
}
```

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
  "affectedServices": 1,
  "services": [
    {
      "id": 2076504302,
      "name": "payment-api",
      "repo": "company/payment-api",
      "team": "payments",
      "environment": "production",
      "hops": 0
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

Calculate risk score for a version key.

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
  "affectedServices": 1,
  "productionServices": 1,
  "maxDepth": 5,
  "services": [
    {
      "serviceId": 2076504302,
      "name": "payment-api",
      "environment": "production",
      "hops": 0,
      "score": 90,
      "severity": "CRITICAL",
      "reasons": ["Affected production service", "Direct dependency"]
    }
  ]
}
```

#### cURL

```bash
curl "http://localhost:3000/versions/npm:axios@1.7.2/risk?depth=5"
```

---

### GET /versions/:versionKey/attack-path

Find the shortest path from each affected service to the vulnerable package version.

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
  "affectedServices": 1,
  "attackPaths": [
    {
      "serviceId": 2076504302,
      "serviceName": "payment-api",
      "environment": "production",
      "hops": 0,
      "path": ["npm:axios@1.7.2"]
    }
  ]
}
```

**AttackPath fields:**

| Field | Type | Description |
|-------|------|-------------|
| `serviceId` | `number` | Unique service ID |
| `serviceName` | `string` | Service name |
| `environment` | `string \| null` | Service environment |
| `hops` | `number` | Number of dependency hops |
| `path` | `string[]` | Ordered version keys from service to compromised package |

#### cURL

```bash
curl "http://localhost:3000/versions/npm:axios@1.7.2/attack-path?depth=5"
```

---

### GET /versions/:versionKey/co-maintainers

Find all packages that share at least one maintainer with the given package. Useful when a package is compromised — the maintainer's other packages may also be at risk.

#### Request

```
GET /versions/:versionKey/co-maintainers
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `:versionKey` | `string` | ✅ | URL-encoded version key (e.g. `npm:axios@1.7.2`) |

#### Response — `200 OK`

```json
{
  "version": "npm:axios@1.7.2",
  "coMaintainerCount": 2,
  "packages": [
    {
      "packageName": "some-other-pkg",
      "sharedMaintainers": ["nick"],
      "sharedCount": 1
    },
    {
      "packageName": "another-pkg",
      "sharedMaintainers": ["nick", "axios-maintainer"],
      "sharedCount": 2
    }
  ]
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `version` | `string` | The queried version key |
| `coMaintainerCount` | `number` | Number of co-maintained packages found |
| `packages` | `array` | List of packages sharing maintainers |

**Package object:**

| Field | Type | Description |
|-------|------|-------------|
| `packageName` | `string` | Name of the co-maintained package |
| `sharedMaintainers` | `string[]` | Usernames of shared maintainers |
| `sharedCount` | `number` | Number of shared maintainers |

Results are sorted by `sharedCount` descending, then alphabetically.

#### Graph Query

```
(pkg:Package)-[:HAS_VERSION]->(v:Version {key: $key})
(m:Maintainer)-[:MAINTAINS]->(pkg)
(m)-[:MAINTAINS]->(other:Package)
```

#### Error Responses

| Status | Body |
|--------|------|
| `404` | `{ "error": "Version not found: npm:axios@1.7.2" }` |
| `500` | `{ "error": "Failed to query co-maintainers" }` |

#### cURL

```bash
curl "http://localhost:3000/versions/npm:axios@1.7.2/co-maintainers"
```

---

### POST /lockfiles/resolve

Given a compromised version and a list of lockfile entries, check which entries resolved to the compromised version and which services they belong to.

This answers: **"Which lockfiles resolved to the bad version while it was live?"**

#### Request

```
POST /lockfiles/resolve
Content-Type: application/json
```

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `compromisedVersion` | `string` | ✅ | Full version key of the compromised package (e.g. `"npm:axios@1.7.2"`) |
| `entries` | `LockfileEntry[]` | ✅ | Array of lockfile entries to check |

**LockfileEntry:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ✅ | Package name (e.g. `"axios"`) |
| `version` | `string` | ✅ | Resolved version (e.g. `"1.7.2"`) |

#### Request Example

```json
{
  "compromisedVersion": "npm:axios@1.7.2",
  "entries": [
    { "name": "axios", "version": "1.7.2" },
    { "name": "lodash", "version": "4.17.21" },
    { "name": "express", "version": "4.18.2" }
  ]
}
```

#### Response — `200 OK`

```json
{
  "compromisedVersion": "npm:axios@1.7.2",
  "compromisedPackage": "axios",
  "checkedEntries": 3,
  "resolvedToCompromised": 1,
  "matches": [
    {
      "name": "axios",
      "version": "1.7.2",
      "inGraph": true,
      "services": [
        {
          "serviceName": "payment-api",
          "environment": "production",
          "hops": 0
        }
      ]
    },
    {
      "name": "lodash",
      "version": "4.17.21",
      "inGraph": false,
      "services": []
    },
    {
      "name": "express",
      "version": "4.18.2",
      "inGraph": true,
      "services": []
    }
  ]
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `compromisedVersion` | `string` | The queried compromised version key |
| `compromisedPackage` | `string` | Package name extracted from the version key |
| `checkedEntries` | `number` | Number of entries checked |
| `resolvedToCompromised` | `number` | Number of entries that match the compromised version AND are connected to services |
| `matches` | `array` | Per-entry results |

**Match object:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Package name |
| `version` | `string` | Version string |
| `inGraph` | `boolean` | Whether this version exists in the graph |
| `services` | `array` | Services that transitively depend on this version and reach the compromised version |

#### How it works

1. Verifies the compromised version exists in the graph
2. Loads all `Service → DEPENDS_ON_VERSION → Version` relationships
3. For each lockfile entry, checks if it exists in the graph
4. For entries connected to services, performs application-level BFS to see if the entry's dependency tree reaches the compromised version
5. Returns matching services with hop count

#### Error Responses

| Status | Body |
|--------|------|
| `400` | `{ "error": "compromisedVersion is required..." }` |
| `400` | `{ "error": "entries array is required..." }` |
| `404` | `{ "error": "Version not found: npm:axios@1.7.2" }` |
| `500` | `{ "error": "Failed to resolve lockfile entries" }` |

#### cURL

```bash
curl -X POST http://localhost:3000/lockfiles/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "compromisedVersion": "npm:axios@1.7.2",
    "entries": [
      {"name": "axios", "version": "1.7.2"},
      {"name": "lodash", "version": "4.17.21"}
    ]
  }'
```

---

### GET /typosquat/:packageName

Detect typosquatting candidates for a given package name. Uses Levenshtein edit distance over all Package names in the graph.

#### Request

```
GET /typosquat/:packageName?threshold=2
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `:packageName` | `string` | ✅ | — | URL-encoded package name to check |
| `?threshold` | `integer` | ❌ | `2` | Maximum edit distance (1–5) |

#### Response — `200 OK`

```json
{
  "targetPackage": "axios",
  "threshold": 2,
  "candidates": [
    {
      "packageName": "axio",
      "editDistance": 1,
      "sharedPrefix": true,
      "sharedSuffix": false,
      "popularity": "unknown",
      "riskSignal": "Edit distance 1 — shared prefix"
    },
    {
      "packageName": "axios-r",
      "editDistance": 2,
      "sharedPrefix": true,
      "sharedSuffix": false,
      "popularity": "unknown",
      "riskSignal": "Edit distance 2 — shared prefix"
    }
  ]
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `targetPackage` | `string` | The queried package name |
| `threshold` | `number` | The edit distance threshold used |
| `candidates` | `array` | Packages within edit distance threshold |

**Candidate object:**

| Field | Type | Description |
|-------|------|-------------|
| `packageName` | `string` | Potential typosquat name |
| `editDistance` | `number` | Levenshtein distance from target |
| `sharedPrefix` | `boolean` | First 3 characters match |
| `sharedSuffix` | `boolean` | Last 3 characters match |
| `popularity` | `string` | `"high"`, `"medium"`, `"low"`, or `"unknown"` |
| `riskSignal` | `string` | Human-readable risk assessment |

**Popularity classification:**

- `high`: Well-known packages (lodash, react, express, etc.)
- `medium`: Short names (≤6 chars)
- `low`: Longer names (≤12 chars)
- `unknown`: Very long or uncommon names

#### cURL

```bash
curl "http://localhost:3000/typosquat/axios?threshold=2"
```

---

### GET /pypi/:packageName/:version/ingest

Ingest a PyPI package version and its transitive dependencies into the graph database. Uses the `pypi:` version key prefix.

#### Request

```
GET /pypi/:packageName/:version/ingest?depth=2
```

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `:packageName` | `string` | ✅ | — | PyPI package name (e.g. `requests`) |
| `:version` | `string` | ✅ | — | Exact version (e.g. `2.32.3`) |
| `?depth` | `integer` | ❌ | `2` | Transitive dependency depth to crawl |

#### Response — `200 OK`

```json
{
  "success": true,
  "packageName": "requests",
  "version": "2.32.3",
  "versionKey": "pypi:requests@2.32.3",
  "stats": {
    "packages": 5,
    "versions": 5,
    "dependencyEdges": 4,
    "packageVersionEdges": 5,
    "maintainers": 1,
    "maintainsEdges": 1,
    "processedNodes": 1,
    "skippedNodes": 0,
    "failedNodes": 0,
    "maxDepth": 0
  }
}
```

**How it works:**

1. Fetches package metadata from `https://pypi.org/pypi/<package>/json`
2. Normalizes PEP 508 dependency strings into the same format as npm
3. Resolves version specifiers (e.g. `>=2.0,<4`) to concrete versions via PyPI API
4. Writes `Package`, `Version`, `Maintainer` vertices and `DEPENDS_ON`, `HAS_VERSION`, `MAINTAINS` edges into HydraDB
5. Uses `pypi:` prefix for all version keys (e.g. `pypi:requests@2.32.3`)

#### Supported Lockfiles (CLI)

The CLI can parse these PyPI lockfile formats:

| Format | File | Status |
|--------|------|--------|
| pip | `requirements.txt` | ✅ Supported |
| Poetry | `poetry.lock` | ✅ Supported |
| Pipenv | `Pipfile.lock` | ✅ Supported |

#### Error Responses

| Status | Body |
|--------|------|
| `400` | `{ "error": "Package name is required" }` |
| `400` | `{ "error": "Version is required" }` |
| `400` | `{ "error": "Depth must be a non-negative integer" }` |
| `500` | `{ "error": "PyPI package ingestion failed" }` |

#### cURL

```bash
curl "http://localhost:3000/pypi/requests/2.32.3/ingest?depth=1"
```

---

## Data Types

### Version Key Format

```
npm:<packageName>@<version>     # npm packages
pypi:<packageName>@<version>    # PyPI packages
```

Examples:
- `npm:axios@1.7.2`
- `npm:follow-redirects@1.16.0`
- `npm:@scope/package@1.0.0`
- `pypi:requests@2.32.3`
- `pypi:flask@3.0.0`

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

4. Security team checks co-maintainers
   → GET /versions/:key/co-maintainers
   → Finds other packages at risk from the same maintainer

5. Incident response: check lockfiles
   → POST /lockfiles/resolve
   → Identifies which services resolved the bad version

6. Threat intelligence: check typosquats
   → GET /typosquat/:packageName
   → Finds suspiciously similar package names

7. Service registration (from CLI or CI/CD)
   → POST /services
   → Registers a service with its dependencies

8. PyPI analysis (same flow as npm)
   → GET /pypi/:packageName/:version/ingest?depth=2
   → Ingests PyPI package graph
```

---

## Graph Data Model

The backend stores a property graph in HydraDB:

```
Package ──[:HAS_VERSION]──▶ Version ──[:DEPENDS_ON]──▶ Version
                                    ▲
Service ──[:DEPENDS_ON_VERSION]─────┘
Maintainer ──[:MAINTAINS]──▶ Package
```

**Node properties:**

| Label | Property | Type | Description |
|-------|----------|------|-------------|
| `Package` | `id` | `number` | Unique ID (FNV-1a hash) |
| `Package` | `name` | `string` | Package name |
| `Package` | `ecosystem` | `string` | `"npm"` |
| `Version` | `id` | `number` | Unique ID (FNV-1a hash) |
| `Version` | `key` | `string` | Version key (`npm:name@version` or `pypi:name@version`) |
| `Version` | `packageName` | `string` | Package name |
| `Version` | `version` | `string` | Semver/version string |
| `Version` | `ecosystem` | `string` | `"npm"` |
| `Service` | `id` | `number` | Unique service ID |
| `Service` | `name` | `string` | Service name |
| `Service` | `repo` | `string` | Repository |
| `Service` | `team` | `string?` | Owning team |
| `Service` | `environment` | `string?` | Environment |
| `Maintainer` | `id` | `number` | Unique ID (FNV-1a hash) |
| `Maintainer` | `username` | `string` | npm/PyPI username |

**Edge properties:**

| Relationship | Property | Type | Description |
|-------------|----------|------|-------------|
| `HAS_VERSION` | `id` | `number` | Edge ID |
| `DEPENDS_ON` | `id` | `number` | Edge ID |
| `DEPENDS_ON` | `packageName` | `string` | Dependency name |
| `DEPENDS_ON` | `versionRange` | `string` | Semver/PEP 440 range |
| `DEPENDS_ON` | `dependencyType` | `string` | `runtime` / `optional` / `peer` |
| `DEPENDS_ON_VERSION` | `id` | `number` | Edge ID |
| `MAINTAINS` | `id` | `number` | Edge ID |
