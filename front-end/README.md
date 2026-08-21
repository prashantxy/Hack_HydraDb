This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Console

`/console` is a set of pages that drive the ChainTrace backend API directly. It
is separate from the landing page at `/`.

| Route | Endpoint | View |
|---|---|---|
| `/console` | `GET /health`, `GET /services` | API map and graph summary |
| `/console/analysis` | `GET /packages/:n/:v/analysis?depth=` | Risk + blast radius + paths in one request |
| `/console/graph` | `GET /packages/:name/graph?depth=` | 3D graph — one sphere shell per hop |
| `/console/blast` | `GET /versions/:key/blast-radius?depth=` | Services by hop distance, coloured by severity |
| `/console/paths` | `GET /versions/:key/attack-path?depth=` | Each service→version chain, in order |
| `/console/risk` | `GET /versions/:key/risk?depth=` | Score per service with reasons and the rules |
| `/console/maintainers` | `GET /versions/:key/co-maintainers` | Packages sharing a maintainer account |
| `/console/lockfile` | `POST /lockfiles/resolve` | Which pasted lockfile entries took the bad version |
| `/console/typosquat` | `GET /typosquat/:name?threshold=` | Names within N edits, with prefix/popularity signals |
| `/console/services` | `GET /services` | The service registry |

### Ecosystems

The graph holds npm and PyPI side by side, separated only by the version-key
prefix (`npm:axios@1.7.2`, `pypi:requests@2.32.3`). Every version-keyed view has
an `eco` toggle that builds the right prefix.

Note: `GET /packages/:name/graph` returns node `packageName` values with the
`pypi:` prefix still attached, because `parseVersionKey` in
`backend/src/graph/graph-service.ts` only strips `npm:`. The console strips
either prefix for display, but the raw response still carries it.

### Pointing it at the API

`NEXT_PUBLIC_CHAINTRACE_API` defaults to `http://localhost:3000` — the same port
`next dev` binds, so **one of the two has to move** or every request 404s
against the front-end itself. Either run the backend elsewhere:

```bash
PORT=4000 bun run src/server.ts && echo 'NEXT_PUBLIC_CHAINTRACE_API=http://localhost:4000' > front-end/.env.local
```

…or run the front-end elsewhere (`next dev -p 3001`) and leave the default. The
backend sends `Access-Control-Allow-Origin: *`, so the browser calls it directly.

### Live vs sample data

One indicator, top right, describes what is actually on screen:

- **live** — the last request came from the API
- **sample data** — it failed, so the sample set is showing; the tooltip carries
  the reason and the API base, and clicking it retries

Sample risk scores come from a port of `backend/src/graph/query/risk.ts`, so demo
numbers match what the backend would return for the same graph.

### One target, every page

The package, version, ecosystem and depth are console-wide state, persisted to
`localStorage`. Set them anywhere and every other view is already asking about
the same thing — no retyping per page. Defaults to `npm:axios@1.7.2`, which is
what the backend's own seed dataset holds.

### Notes

- Writes (`POST /services`, `GET /packages/:n/:v/ingest`) are never issued on
  page load. The services page shows the `curl` instead.
- The 3D view scales the graph to a fixed radius rather than moving the camera,
  so depth 1 and depth 5 both frame correctly.
- Clicking a node flies the camera to it and defocuses everything off its path
  back to hop 0. Clear it by clicking past the graph, pressing `Escape`, or
  clicking the node again. Labels render at a fixed screen size, so they stay
  readable at any zoom.
- Auto-rotation stops the first time you take hold of the graph, and
  `prefers-reduced-motion` disables it outright.
- The graph page has a filterable version list — selecting a row focuses that
  node, which beats hunting for one package in a 48-node cloud.
