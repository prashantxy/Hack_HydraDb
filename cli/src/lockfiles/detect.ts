import { existsSync } from "node:fs";
import { join } from "node:path";

export type LockfileType =
  | "npm"
  | "pnpm"
  | "yarn"
  | "bun"
  | "unknown";

export interface LockfileInfo {
  type: LockfileType;
  path: string | null;
}

export function detectLockfile(
  cwd = process.cwd(),
): LockfileInfo {
  const candidates = [
    {
      type: "bun" as const,
      file: "bun.lock",
    },
    {
      type: "bun" as const,
      file: "bun.lockb",
    },
    {
      type: "npm" as const,
      file: "package-lock.json",
    },
    {
      type: "npm" as const,
      file: "npm-shrinkwrap.json",
    },
    {
      type: "pnpm" as const,
      file: "pnpm-lock.yaml",
    },
    {
      type: "yarn" as const,
      file: "yarn.lock",
    },
  ];

  for (const candidate of candidates) {
    const path =
      join(cwd, candidate.file);

    if (existsSync(path)) {
      return {
        type: candidate.type,
        path,
      };
    }
  }

  return {
    type: "unknown",
    path: null,
  };
}