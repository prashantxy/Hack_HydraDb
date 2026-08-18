import { ingestPackage } from "../src/npm/ingest";

const packageName =
  process.argv[2] ?? "axios";

const requestedVersion =
  process.argv[3] ?? "1.7.2";

const depthArgIndex =
  process.argv.indexOf("--depth");

const maxDepth =
  depthArgIndex !== -1
    ? Number(process.argv[depthArgIndex + 1])
    : 2;

if (!Number.isInteger(maxDepth) || maxDepth < 0) {
  throw new Error(
    `Invalid depth: ${maxDepth}`,
  );
}

console.log(
  `Starting recursive ingestion`,
);

console.log(
  `Package: ${packageName}`,
);

console.log(
  `Version: ${requestedVersion}`,
);

console.log(
  `Max depth: ${maxDepth}`,
);

await ingestPackage({
  packageName,
  version: requestedVersion,
  maxDepth,
  concurrency: 5,
});