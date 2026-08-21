FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies (cached layer)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source
COPY src/ src/
COPY tsconfig.json ./

# The server reads .env at runtime via dotenv/config
# Do NOT bake .env into the image

EXPOSE 3001

CMD ["bun", "src/server.ts"]
