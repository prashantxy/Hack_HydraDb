#!/usr/bin/env bun

import {
  Command,
} from "commander";

import {
  scanProject,
} from "./command/scan";

import {
  checkCommand,
} from "./command/check";

const program =
  new Command();

program
  .name("chaintrace")
  .description(
    "Software supply-chain security CLI",
  )
  .version("0.1.0");

// ==========================================================
// SCAN
// ==========================================================

program
  .command("scan")
  .description(
    "Scan a project dependency tree",
  )
  .option(
    "-p, --path <path>",
    "Project directory",
    ".",
  )
  .option(
    "-d, --depth <number>",
    "Dependency traversal depth",
    "5",
  )
  .action(
    async (options) => {
      try {
        const projectPath =
          options.path ?? ".";

        const depth =
          Number(options.depth);

        if (
          !Number.isInteger(depth) ||
          depth < 0
        ) {
          throw new Error(
            "depth must be a non-negative integer",
          );
        }

        console.log(
          `Scanning project: ${projectPath}`,
        );

        const result =
          await scanProject(
            projectPath,
          );

        console.log("");
        console.log(
          `Lockfile: ${result.lockfile.type}`,
        );

        console.log(
          `Path: ${result.lockfile.path}`,
        );

        console.log(
          `Dependencies found: ${result.dependencies.length}`,
        );

        console.log("");

        for (
          const dependency
          of result.dependencies
        ) {
          console.log(
            `  ${dependency.name}@${dependency.version}`,
          );
        }

        console.log("");
        console.log(
          `Depth: ${depth}`,
        );

      } catch (error) {
        console.error(
          "Scan failed:",
          error instanceof Error
            ? error.message
            : error,
        );

        process.exit(1);
      }
    },
  );

// ==========================================================
// CHECK
// ==========================================================

program
  .command("check")
  .description(
    "Analyze a specific package version",
  )
  .argument(
    "<package>",
    "Package specification, e.g. axios@1.7.2",
  )
  .option(
    "-d, --depth <number>",
    "Dependency traversal depth",
    "5",
  )
  .action(
    async (
      packageSpec,
      options,
    ) => {
      try {
        const depth =
          Number(options.depth);

        if (
          !Number.isInteger(depth) ||
          depth < 0
        ) {
          throw new Error(
            "depth must be a non-negative integer",
          );
        }

        await checkCommand(
          packageSpec,
          depth,
        );
      } catch (error) {
        console.error(
          "Check failed:",
          error instanceof Error
            ? error.message
            : error,
        );

        process.exit(1);
      }
    },
  );

await program.parseAsync();