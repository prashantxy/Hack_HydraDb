# ChainTrace CLI Reference

> **Complete CLI documentation for developers and integrators.**
> Package name: `chaintrace`
> Runtime: Bun

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Commands](#commands)
   - [chaintrace scan](#chaintrace-scan)
   - [chaintrace check](#chaintrace-check)
   - [chaintrace github login](#chaintrace-github-login)
5. [Supported Lockfiles](#supported-lockfiles)
6. [Exit Codes](#exit-codes)
7. [Output Format](#output-format)
8. [Environment Variables](#environment-variables)
9. [Error Handling](#error-handling)
10. [Architecture](#architecture)

---

## Overview

ChainTrace CLI is a supply-chain security tool that:

1. **Scans** project lockfiles to discover all dependencies
2. **Analyzes** each dependency's risk score, blast radius, and attack paths
3. **Reports** a security summary sorted by severity
4. **Integrates** with CI/CD via exit codes

The CLI communicates with the ChainTrace backend API to perform graph-based analysis.

```
┌──────────┐      ┌──────────────┐      ┌──────────────┐
│   CLI    │ ───▶ │  Backend API │ ───▶ │  HydraDB     │
│  (scan)  │      │  :3000       │      │  (graph DB)  │
└──────────┘      └──────────────┘      └──────────────┘
```

---

## Installation

### From source (development)

```bash
cd cli
bun install
bun run dev
```

### Build standalone binary

```bash
bun run build
# Output: ./dist/chaintrace
```

### Global install (after build)

```bash
# Add to PATH or symlink
ln -s ./dist/chaintrace /usr/local/bin/chaintrace
```

### Verify installation

```bash
chaintrace --version
# 0.1.0
```

---

## Configuration

### Required environment variables

| Variable | Description | Where to set |
|----------|-------------|--------------|
| `CHAINTRACE_API_URL` | Backend API URL | `cli/.env` or shell |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID | `cli/.env` |
| `CHAINTRACE_DEBUG` | Enable debug logging | `cli/.env` or shell |

### `.env` file format

```env
CHAINTRACE_API_URL=http://localhost:3000
GITHUB_CLIENT_ID=your_github_client_id_here
CHAINTRACE_DEBUG=true
```

### Defaults

| Variable | Default |
|----------|---------|
| `CHAINTRACE_API_URL` | `http://localhost:3000` |
| `GITHUB_CLIENT_ID` | _(none — required for github login)_ |
| `CHAINTRACE_DEBUG` | `undefined` (disabled) |

---

## Commands

---

### `chaintrace scan`

Scan a project's lockfile and analyze all dependencies for supply-chain risks.

#### Usage

```bash
chaintrace scan
chaintrace scan --path ./my-project
chaintrace scan --path ./backend --depth 3
chaintrace scan -p ./frontend -d 10
```

#### Options

| Flag | Alias | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--path <path>` | `-p` | `string` | `"."` (current directory) | Project directory to scan |
| `--depth <number>` | `-d` | `string` → parsed as `number` | `"5"` | BFS traversal depth for dependency graph (0–5) |

#### What it does

```
1. Detect lockfile type (npm / bun / pnpm / yarn)
2. Parse lockfile → extract all dependencies
3. For each dependency:
   a. Call ensurePackage() → GET /packages/:name/:version/analysis
   b. If package not in graph → GET /packages/:name/:version/ingest (auto-ingest)
   c. Receive risk score, blast radius, attack paths
4. Sort results by severity (CRITICAL → HIGH → MEDIUM → LOW)
5. Print summary table
6. Set exit code for CI
```

#### Sample output

```
╔══════════════════════════════════════════════╗
║              ChainTrace Scan                 ║
╚══════════════════════════════════════════════╝

Project: .
Depth:   5

Lockfile: npm
Path:     /home/user/project/package-lock.json
Dependencies found: 142

Analyzing dependency risk...

  axios@1.7.2 ... ✗ CRITICAL (90/100)
  follow-redirects@1.16.0 ... ⚠ HIGH (70/100)
  form-data@4.0.6 ... ⚠ MEDIUM (40/100)
  mime-types@2.1.35 ... ✓ LOW (10/100)
  qs@6.13.0 ... ✓ LOW (5/100)
  ...

══════════════════════════════════════════════
             ChainTrace Security Summary
══════════════════════════════════════════════

Dependencies analyzed: 142/142
Critical: 1
High:     3
Medium:   12
Low:      126

Top risks:

  ✗ CRITICAL axios@1.7.2 — 90/100

      ┌─ SERVICE IMPACT
      │ axios@1.7.2
      │ affected services: 3
      │ production services: 2
      │
      ├─ payment-api [production] (0 hops)
      │  ├─ Affected production service
      │  └─ Direct dependency
      ├─ checkout-service [production] (1 hop)
      │  ├─ Affected production service
      │  └─ One-hop transitive dependency
      └─ analytics-api [staging] (2 hops)
         ├─ Affected staging service
         └─ 2-hop transitive dependency
      └────────────────────────

Dashboard:
http://localhost:3001

✗ CRITICAL supply-chain risks detected.
```

#### Severity symbols

| Symbol | Severity | Meaning |
|--------|----------|---------|
| `✗ CRITICAL` | Score ≥ 80 | Direct dependency in production |
| `⚠ HIGH` | Score ≥ 60 | Production service affected |
| `⚠ MEDIUM` | Score ≥ 30 | Staging or deep transitive |
| `✓ LOW` | Score < 30 | Non-production, few hops |

#### What it does NOT do

- Does **not** modify any files
- Does **not** install/uninstall packages
- Does **not** require write access to the project
- Does **not** run arbitrary code from dependencies

---

### `chaintrace check`

Analyze a single package version. Returns full security analysis with attack paths.

#### Usage

```bash
chaintrace check axios@1.7.2
chaintrace check react@19.2.8 --depth 10
chaintrace check lodash@4.17.21 -d 3
```

#### Arguments

| Argument | Required | Format | Description |
|----------|----------|--------|-------------|
| `<package>` | ✅ | `name@version` | Package specification (e.g. `axios@1.7.2`) |

#### Options

| Flag | Alias | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--depth <number>` | `-d` | `string` → parsed as `number` | `5` | BFS traversal depth (0–5) |

#### What it does

```
1. Parse package spec → extract name and version
2. Call checkPackage() → GET /packages/:name/:version/analysis?depth=N
3. Print formatted analysis
4. Show dashboard link
```

#### Sample output

```
Analyzing axios@1.7.2...

Package: axios@1.7.2
Version Key: npm:axios@1.7.2

Risk: 90/100
Severity: CRITICAL

Affected services: 3
Production services: 2

Attack paths:
  payment-api
    environment: production
    hops: 0
    npm:axios@1.7.2
  checkout-service
    environment: production
    hops: 1
    npm:form-data@4.0.6 → npm:axios@1.7.2
  analytics-api
    environment: staging
    hops: 2
    npm:mime-types@2.1.35 → npm:form-data@4.0.6 → npm:axios@1.7.2

Dashboard: http://localhost:3001/packages/axios/1.7.2
```

#### Package format validation

The `<package>` argument must match `name@version`:

| Input | Result |
|-------|--------|
| `axios@1.7.2` | ✅ Valid → name=`axios`, version=`1.7.2` |
| `@scope/pkg@1.0.0` | ✅ Valid → name=`@scope/pkg`, version=`1.0.0` |
| `axios` | ❌ Error: `Expected package format: axios@1.7.2` |
| `axios@` | ❌ Error: `Expected package format: axios@1.7.2` |
| `@scope/pkg` | ❌ Error: `Expected package format: axios@1.7.2` |

---

### `chaintrace github login`

Authenticate ChainTrace with GitHub using Device Code OAuth flow.

#### Usage

```bash
chaintrace github login
```

#### Options

None.

#### What it does

```
1. Request a device code from GitHub OAuth
2. Display verification URL and user code
3. Poll GitHub for authorization (waits for user to approve)
4. Fetch authenticated user profile
5. Display success message
```

#### Sample output

```
╔══════════════════════════════════════════════╗
║            GitHub Authentication             ║
╚══════════════════════════════════════════════╝

Open: https://github.com/login/device

Code: ABCD-1234

Waiting for GitHub authorization.....
✓ GitHub authorization successful

  User: @octocat
  Name: The Octocat
  GitHub ID: 12345678

GitHub is now connected to ChainTrace.
```

#### Prerequisites

- `GITHUB_CLIENT_ID` must be set in `cli/.env`
- User must visit the verification URL and enter the code
- GitHub OAuth App must have these scopes:
  - `repo` — Read private repositories
  - `read:user` — Read authenticated user profile

#### OAuth flow details

| Step | Endpoint | Method |
|------|----------|--------|
| 1. Request device code | `https://github.com/login/device/code` | POST |
| 2. Poll for token | `https://github.com/login/oauth/access_token` | POST |
| 3. Get user profile | `https://api.github.com/user` | GET |

#### Polling behavior

- Polls every `interval` seconds (default: 5s)
- Handles `authorization_pending` — continues polling
- Handles `slow_down` — increases interval by 5s
- Handles `access_denied` — throws error
- Handles `expired_token` — throws error
- Timeout: `expires_in` seconds from device code request (typically 900s / 15min)

---

## Supported Lockfiles

The CLI automatically detects and parses these lockfile types:

| Lockfile | File | Status | Notes |
|----------|------|--------|-------|
| **npm** | `package-lock.json` | ✅ Supported | v1, v2, v3 |
| **npm** | `npm-shrinkwrap.json` | ✅ Supported | Same format as v1 |
| **Bun** | `bun.lock` | ✅ Supported | JSON format |
| **Bun** | `bun.lockb` | ✅ Supported | Binary format (detected) |
| **pnpm** | `pnpm-lock.yaml` | ⚠️ Detected | Parsing not yet implemented |
| **Yarn** | `yarn.lock` | ⚠️ Detected | Parsing not yet implemented |

### Detection priority

Lockfiles are checked in this order:

1. `bun.lock`
2. `bun.lockb`
3. `package-lock.json`
4. `npm-shrinkwrap.json`
5. `pnpm-lock.yaml`
6. `yarn.lock`

### npm lockfile parsing

**v2/v3 format** (`packages` key):

```json
{
  "lockfileVersion": 3,
  "packages": {
    "node_modules/axios": {
      "version": "1.7.2",
      "resolved": "https://registry.npmjs.org/axios/-/axios-1.7.2.tgz",
      "integrity": "sha512-...",
      "dev": false
    }
  }
}
```

**v1 format** (`dependencies` key):

```json
{
  "lockfileVersion": 1,
  "dependencies": {
    "axios": {
      "version": "1.7.2",
      "resolved": "https://registry.npmjs.org/axios/-/axios-1.7.2.tgz",
      "integrity": "sha512-...",
      "dev": false
    }
  }
}
```

### Bun lockfile parsing

Handles multiple Bun lockfile representations:

1. **Primary**: `packages` map with version metadata objects
2. **Fallback**: Recursive walk for `name@version` string patterns
3. **JSONC**: Strips comments and trailing commas before parsing

### Dependency object format

All parsers produce a normalized `Dependency[]`:

```typescript
interface Dependency {
  name: string;        // Package name (e.g. "axios", "@scope/pkg")
  version: string;     // Exact semver (e.g. "1.7.2")
  source: "lockfile";  // Always "lockfile"
  dev: boolean;        // Whether this is a devDependency
  resolved?: string;   // Registry URL (npm only)
  integrity?: string;  // SRI hash (npm only)
}
```

---

## Exit Codes

The CLI uses exit codes for CI/CD integration:

| Code | Meaning | Triggered by |
|------|---------|--------------|
| `0` | Success — no high-risk dependencies | `chaintrace scan` when no CRITICAL or HIGH found |
| `1` | Warning — HIGH risks detected | `chaintrace scan` when HIGH found |
| `2` | Failure — CRITICAL risks detected | `chaintrace scan` when CRITICAL found |

### CI/CD usage

```bash
# In CI pipeline
chaintrace scan --path . --depth 5
EXIT_CODE=$?

if [ $EXIT_CODE -eq 2 ]; then
  echo "❌ CRITICAL supply-chain risks found"
  exit 1  # Fail the build
elif [ $EXIT_CODE -eq 1 ]; then
  echo "⚠️ HIGH supply-chain risks found"
  # Optionally fail or warn
fi
```

### GitHub Actions example

```yaml
- name: ChainTrace Security Scan
  run: |
    chaintrace scan --path . --depth 5
  env:
    CHAINTRACE_API_URL: ${{ secrets.CHAINTRACE_API_URL }}
```

### Exit code flow

```
scan command
  │
  ├── analyze all dependencies
  │
  ├── count severities
  │   ├── critical.length > 0  →  exitCode = 2
  │   ├── high.length > 0      →  exitCode = 1
  │   └── otherwise            →  exitCode = 0 (default)
  │
  └── print summary
```

---

## Output Format

### Scan summary structure

```
╔══════════════════════════════════════════════╗
║              ChainTrace Scan                 ║
╚══════════════════════════════════════════════╝

Project: <path>
Depth:   <depth>

Lockfile: <type>
Path:     <lockfile path>
Dependencies found: <count>

Analyzing dependency risk...

  <name>@<version> ... <severity> (<score>/100)
  ...

══════════════════════════════════════════════
             ChainTrace Security Summary
══════════════════════════════════════════════

Dependencies analyzed: <analyzed>/<total>
Critical: <count>
High:     <count>
Medium:   <count>
Low:      <count>

Top risks:

  <severity> <name>@<version> — <score>/100

      ┌─ SERVICE IMPACT
      │ <name>@<version>
      │ affected services: <count>
      │ production services: <count>
      │
      ├─ <service-name> [<environment>] (<hops> hop(s))
      │  ├─ <reason>
      │  └─ <reason>
      ...
      └────────────────────────

Dashboard:
http://localhost:3001

<exit message>
```

### Check analysis structure

```
Analyzing <name>@<version>...

Package: <name>@<version>
Version Key: npm:<name>@<version>

Risk: <score>/100
Severity: <severity>

Affected services: <count>
Production services: <count>

Attack paths:
  <service-name>
    environment: <env>
    hops: <count>
    <path.join(" → ")>
  ...

Dashboard: http://localhost:3001/packages/<name>/<version>
```

### Service impact tree format

```
┌─ SERVICE IMPACT
│ <package>@<version>
│ affected services: <count>
│ production services: <count>
│
├─ <service-name> [<environment>] (<hops> hop(s))
│  ├─ <reason>
│  └─ <reason>
├─ <service-name> [<environment>] (<hops> hop(s))
│  └─ <reason>
└─ <service-name> [<environment>] (<hops> hop(s))
   ├─ <reason>
   └─ <reason>
└────────────────────────
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CHAINTRACE_API_URL` | No | `http://localhost:3000` | Backend API base URL |
| `GITHUB_CLIENT_ID` | For `github login` | — | GitHub OAuth App client ID |
| `CHAINTRACE_DEBUG` | No | — | Set to any value to enable debug output |

### `CHAINTRACE_API_URL`

Override the backend API URL. Useful for:

- Remote API servers
- Docker containers
- Different environments

```bash
CHAINTRACE_API_URL=https://api.chaintrace.dev chaintrace scan
```

### `CHAINTRACE_DEBUG`

When set, shows error details for failed package analyses:

```bash
CHAINTRACE_DEBUG=1 chaintrace scan
```

---

## Error Handling

### Common errors

| Error | Cause | Solution |
|-------|-------|----------|
| `No supported lockfile found` | No `package-lock.json`, `bun.lock`, etc. in path | Run from project root or use `--path` |
| `Expected package format: axios@1.7.2` | Missing `@version` in `check` argument | Use `name@version` format |
| `Depth must be a non-negative integer` | Invalid depth value | Use a non-negative integer |
| `ChainTrace API error (500): ...` | Backend server error | Check backend is running |
| `ChainTrace API error (404): ...` | Package/version not in graph | Run `ingest` first or let `ensurePackage` handle it |
| `Failed to parse bun.lock` | Corrupted or unsupported Bun lockfile | Regenerate with `bun install` |
| `GITHUB_CLIENT_ID is not configured` | Missing env var for GitHub login | Set `GITHUB_CLIENT_ID` in `cli/.env` |

### Error recovery

The CLI uses `process.exitCode` instead of `process.exit()` to allow:

- Cleanup handlers to run
- Graceful failure in CI
- Proper stream flushing

### Debug mode

Set `CHAINTRACE_DEBUG=true` to see:

- Raw error messages from failed analyses
- API response details
- Stack traces

---

## Architecture

### File structure

```
cli/
├── src/
│   ├── index.ts                    # CLI entry point (Commander setup)
│   ├── command/
│   │   ├── scan.ts                 # Scan command implementation
│   │   ├── check.ts                # Check command implementation
│   │   └── github.ts               # GitHub login command
│   ├── api/
│   │   ├── client.ts               # API client (fetch wrappers)
│   │   ├── chaintrace.ts           # (empty — reserved)
│   │   └── ingest.ts               # (empty — reserved)
│   ├── lockfiles/
│   │   ├── detect.ts               # Lockfile detection
│   │   ├── scan.ts                 # Lockfile scanning orchestrator
│   │   ├── npm.ts                  # npm lockfile parser
│   │   ├── bun.ts                  # Bun lockfile parser
│   │   ├── pnpm-lock.ts            # (empty — not yet implemented)
│   │   ├── yarn-lock.ts            # (empty — not yet implemented)
│   │   └── index.ts                # Re-exports
│   ├── github/
│   │   ├── auth.ts                 # GitHub Device Code OAuth
│   │   └── client.ts               # (empty — reserved)
│   └── output/
│       └── terminal.ts             # Terminal output formatting
├── package.json
├── tsconfig.json
└── .env
```

### API client methods

| Method | Backend Endpoint | Purpose |
|--------|-----------------|---------|
| `getPackageRisk()` | `GET /packages/:name/:version/risk` | Get risk score only |
| `checkPackage()` | `GET /packages/:name/:version/analysis` | Full analysis |
| `ingestPackage()` | `GET /packages/:name/:version/ingest` | Ingest into graph DB |
| `ensurePackage()` | Auto (try analysis → ingest → retry) | Ensure package exists in graph |
| `checkPackages()` | Multiple `ensurePackage()` calls | Batch analysis |

### `ensurePackage` flow

```
ensurePackage(name, version, depth)
  │
  ├── try checkPackage(name, version, depth)
  │   │
  │   ├── success → return analysis
  │   │
  │   └── error "Version not found"
  │       │
  │       ├── ingestPackage(name, version, depth)
  │       │
  │       └── checkPackage(name, version, depth)
  │           │
  │           ├── success → return analysis
  │           │
  │           └── error → throw
  │
  └── error (other) → throw
```

### Command dependencies

```
scan
  ├── lockfiles/scan.ts
  │   ├── lockfiles/detect.ts
  │   ├── lockfiles/npm.ts
  │   └── lockfiles/bun.ts
  └── api/client.ts
      └── backend API

check
  └── api/client.ts
      └── backend API
  └── output/terminal.ts

github login
  └── github/auth.ts
      └── GitHub OAuth API
```

---

## Quick Reference

```bash
# Scan current directory
chaintrace scan

# Scan specific project
chaintrace scan --path ./my-app

# Scan with custom depth
chaintrace scan --path ./backend --depth 3

# Check single package
chaintrace check axios@1.7.2

# Check with custom depth
chaintrace check lodash@4.17.21 --depth 10

# GitHub auth
chaintrace github login

# Version
chaintrace --version

# Help
chaintrace --help
chaintrace scan --help
chaintrace check --help
```
