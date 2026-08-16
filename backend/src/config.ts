import "dotenv/config";

export const config = {
  hydra: {
    url:
      process.env.HYDRA_URL ??
      "http://127.0.0.1:8443",

    token:
      process.env.HYDRA_TOKEN ?? "",

    namespace:
      process.env.HYDRA_NAMESPACE ??
      "default",

    cellId:
      process.env.HYDRA_CELL_ID ??
      "cell-0",
  },

  port:
    Number(process.env.PORT ?? 3001),
};

if (!config.hydra.token) {
  throw new Error(
    "HYDRA_TOKEN is not configured",
  );
}