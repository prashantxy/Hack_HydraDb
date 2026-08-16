export function json(
  data: unknown,
  status = 200,
): Response {
  return Response.json(data, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function errorResponse(
  message: string,
  status: number,
): Response {
  return json(
    {
      error: message,
    },
    status,
  );
}