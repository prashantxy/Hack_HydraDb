import {
  loginGitHub,
} from "../github/auth";

export async function githubLoginCommand(): Promise<void> {
  try {
    const result =
      await loginGitHub();

    console.log("");

    console.log(
      "✓ GitHub authentication successful",
    );

    console.log(
      `  User: @${result.user.login}`,
    );

    console.log(
      `  Name: ${result.user.name ?? "-"}`,
    );

    console.log(
      `  GitHub ID: ${result.user.id}`,
    );

    console.log("");

    console.log(
      "GitHub is now connected to ChainTrace.",
    );

    console.log("");

  } catch (error) {
    console.error("");

    console.error(
      "✗ GitHub authentication failed.",
    );

    console.error("");

    console.error(
      error instanceof Error
        ? error.message
        : error,
    );

    console.error("");

    process.exitCode = 1;
  }
}

