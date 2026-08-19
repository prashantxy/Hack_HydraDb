

import { Command } from "commander";

import {
  scanCommand,
} from "./command/scan";

import {
  checkCommand,
} from "./command/check";

import {
  githubLoginCommand,
} from "./command/github";

const program = new Command();

program
  .name("chaintrace")
  .description(
    "Software supply-chain security CLI",
  )
  .version("0.1.0");

// ==========================================================
// SCAN
// ==========================================================
//
// chaintrace scan
// chaintrace scan --path ./backend
// chaintrace scan --path ./backend --depth 5
//
// ==========================================================

program
  .command("scan")
  .description(
    "Scan a project's lockfile and analyze dependencies",
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
        await scanCommand(options);
      } catch (error) {
        console.error(
          "Scan failed:",
          error instanceof Error
            ? error.message
            : error,
        );

        process.exitCode = 1;
      }
    },
  );

// ==========================================================
// CHECK
// ==========================================================
//
// chaintrace check axios@1.7.2
// chaintrace check react@19.2.8
// chaintrace check axios@1.7.2 --depth 10
//
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
        await checkCommand(
          packageSpec,
          Number(options.depth),
        );
      } catch (error) {
        console.error(
          "Check failed:",
          error instanceof Error
            ? error.message
            : error,
        );

        process.exitCode = 1;
      }
    },
  );

// ==========================================================
// GITHUB LOGIN
// ==========================================================
//
// chaintrace github login
//
// ==========================================================

const githubCommand =
  program
    .command("github")
    .description(
      "GitHub authentication and repository operations",
    );

githubCommand
  .command("login")
  .description(
    "Authenticate ChainTrace with GitHub",
  )
  .action(
    async () => {
      await githubLoginCommand();
    },
  );

await program.parseAsync(
  process.argv,
);

