import "dotenv/config";

const HYDRA_URL = process.env.HYDRA_URL;
const HYDRA_TOKEN = process.env.HYDRA_TOKEN;
const HYDRA_NAMESPACE = process.env.HYDRA_NAMESPACE ?? "default";
const HYDRA_CELL_ID = process.env.HYDRA_CELL_ID ?? "cell-0";

if (!HYDRA_URL || !HYDRA_TOKEN) {
  throw new Error("Missing HYDRA_URL or HYDRA_TOKEN");
}

export async function hydraQuery(
  query: string,
): Promise<unknown> {
  const response = await fetch(
    `${HYDRA_URL}/v1/graphs/${HYDRA_NAMESPACE}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HYDRA_TOKEN}`,
        "X-Graph-Namespace": HYDRA_NAMESPACE,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cell_id: HYDRA_CELL_ID,
        query,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `HydraDB query failed (${response.status}): ${body}`,
    );
  }

  return response.json();
}