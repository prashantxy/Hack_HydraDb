import { router } from "./api/router";

process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
});

const PORT = Number(
  process.env.PORT ?? 3001,
);

const server = Bun.serve({
  port: PORT,

  async fetch(req) {
    try {
      return await router(req);
    } catch (error) {
      console.error("Unhandled error:", error);
      return Response.json(
        { error: "Internal server error" },
        { status: 500, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }
  },
});

console.log(
  `ChainTrace API running on http://localhost:${server.port}`,
);