
const GITHUB_CLIENT_ID =
  process.env.GITHUB_CLIENT_ID;

const DEVICE_CODE_URL =
  "https://github.com/login/device/code";

const ACCESS_TOKEN_URL =
  "https://github.com/login/oauth/access_token";

const GITHUB_USER_URL =
  "https://api.github.com/user";

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;

  error?: string;
  error_description?: string;
  interval?: number;
}

export interface GitHubUser {
  login: string;
  id: number;
  name: string | null;
  avatar_url: string;
}

export interface GitHubAuthResult {
  accessToken: string;
  user: GitHubUser;
}

function getClientId(): string {
  if (!GITHUB_CLIENT_ID) {
    throw new Error(
      "GITHUB_CLIENT_ID is not configured. " +
        "Set GITHUB_CLIENT_ID in cli/.env",
    );
  }

  return GITHUB_CLIENT_ID;
}

// ==========================================================
// DEVICE CODE
// ==========================================================

async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const clientId =
    getClientId();

  const body =
    new URLSearchParams();

  body.set(
    "client_id",
    clientId,
  );

  /*
   * Keep scopes minimal.
   *
   * repo:
   *   Allows reading private repositories.
   *
   * read:user:
   *   Allows reading the authenticated user.
   */
  body.set(
    "scope",
    "repo read:user",
  );

  const response =
    await fetch(
      DEVICE_CODE_URL,
      {
        method: "POST",

        headers: {
          Accept:
            "application/json",

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body: body.toString(),
      },
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `GitHub device authorization failed (${response.status}): ${text}`,
    );
  }

  try {
    return JSON.parse(
      text,
    ) as DeviceCodeResponse;
  } catch {
    throw new Error(
      `Invalid GitHub device authorization response: ${text}`,
    );
  }
}

// ==========================================================
// TOKEN POLLING
// ==========================================================

async function pollForToken(
  device: DeviceCodeResponse,
): Promise<string> {
  const clientId =
    getClientId();

  let interval =
    device.interval || 5;

  const expiresAt =
    Date.now() +
    device.expires_in * 1000;

  let attempts = 0;

  while (
    Date.now() < expiresAt
  ) {
    attempts += 1;

    const body =
      new URLSearchParams();

    body.set(
      "client_id",
      clientId,
    );

    body.set(
      "device_code",
      device.device_code,
    );

    body.set(
      "grant_type",
      "urn:ietf:params:oauth:grant-type:device_code",
    );

    const response =
      await fetch(
        ACCESS_TOKEN_URL,
        {
          method: "POST",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body: body.toString(),
        },
      );

    const text =
      await response.text();

    let result: TokenResponse;

    try {
      result =
        JSON.parse(text) as TokenResponse;
    } catch {
      throw new Error(
        `Invalid GitHub token response: ${text}`,
      );
    }

    // ------------------------------------------------------
    // SUCCESS
    // ------------------------------------------------------

    if (result.access_token) {
      console.log(
        "✓ GitHub authorization successful",
      );

      return result.access_token;
    }

    // ------------------------------------------------------
    // USER HAS NOT AUTHORIZED YET
    // ------------------------------------------------------

    if (
      result.error ===
      "authorization_pending"
    ) {
      process.stdout.write(".");

      await Bun.sleep(
        interval * 1000,
      );

      continue;
    }

    // ------------------------------------------------------
    // GITHUB ASKED US TO SLOW DOWN
    // ------------------------------------------------------

    if (
      result.error ===
      "slow_down"
    ) {
      interval += 5;

      console.log(
        `\nGitHub requested slower polling. Retrying in ${interval}s...`,
      );

      await Bun.sleep(
        interval * 1000,
      );

      continue;
    }

    // ------------------------------------------------------
    // USER DENIED
    // ------------------------------------------------------

    if (
      result.error ===
      "access_denied"
    ) {
      throw new Error(
        "GitHub authorization was denied.",
      );
    }

    // ------------------------------------------------------
    // DEVICE CODE EXPIRED
    // ------------------------------------------------------

    if (
      result.error ===
      "expired_token"
    ) {
      throw new Error(
        "GitHub device code expired. " +
          "Run `chaintrace github login` again.",
      );
    }

    // ------------------------------------------------------
    // UNKNOWN ERROR
    // ------------------------------------------------------

    throw new Error(
      result.error_description ??
        result.error ??
        `GitHub authorization failed: ${text}`,
    );
  }

  throw new Error(
    "GitHub authorization timed out. " +
      "Run `chaintrace github login` again.",
  );
}

// ==========================================================
// CURRENT USER
// ==========================================================

async function getGitHubUser(
  accessToken: string,
): Promise<GitHubUser> {
  const response =
    await fetch(
      GITHUB_USER_URL,
      {
        headers: {
          Accept:
            "application/vnd.github+json",

          Authorization:
            `Bearer ${accessToken}`,

          "X-GitHub-Api-Version":
            "2022-11-28",
        },
      },
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Failed to fetch GitHub user (${response.status}): ${text}`,
    );
  }

  try {
    return JSON.parse(
      text,
    ) as GitHubUser;
  } catch {
    throw new Error(
      `Invalid GitHub user response: ${text}`,
    );
  }
}

// ==========================================================
// LOGIN
// ==========================================================

export async function loginGitHub(): Promise<GitHubAuthResult> {
  const device =
    await requestDeviceCode();

  console.log("");

  console.log(
    "╔══════════════════════════════════════════════╗",
  );

  console.log(
    "║            GitHub Authentication             ║",
  );

  console.log(
    "╚══════════════════════════════════════════════╝",
  );

  console.log("");

  console.log(
    `Open: ${device.verification_uri}`,
  );

  console.log("");

  console.log(
    `Code: ${device.user_code}`,
  );

  console.log("");

  console.log(
    "Waiting for GitHub authorization",
  );

  /*
   * Poll GitHub until:
   *
   *   access_token
   *   authorization_pending
   *   slow_down
   *   access_denied
   *   expired_token
   */

  const accessToken =
    await pollForToken(
      device,
    );

  console.log("");

  const user =
    await getGitHubUser(
      accessToken,
    );

  return {
    accessToken,
    user,
  };
}
