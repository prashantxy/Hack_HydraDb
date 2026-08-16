import { router } from "./api/router";

const PORT = Number(
  process.env.PORT ?? 3000,
);

const server = Bun.serve({
  port: PORT,

  async fetch(req) {
    return router(req);
  },
});

console.log(
  `ChainTrace API running on http://localhost:${server.port}`,
);