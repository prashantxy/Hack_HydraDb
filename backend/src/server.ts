const PORT =
  Number(process.env.PORT ?? 3001);

Bun.serve({
  port: PORT,

  fetch(request) {
    const url =
      new URL(request.url);

    if (
      request.method === "GET" &&
      url.pathname === "/health"
    ) {
      return Response.json({
        service: "chaintrace-backend",
        status: "ok",
      });
    }

    return Response.json(
      {
        error: "Not found",
      },
      {
        status: 404,
      },
    );
  },
});

console.log(
  `ChainTrace backend listening on :${PORT}`,
);