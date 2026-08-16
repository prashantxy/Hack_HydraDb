import { json } from "../response";

export function healthRoute(): Response {
  return json({
    status: "ok",
    service: "chaintrace",
  });
}