import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { invalidArgs, internalError } from "../commands/strategy/contract.js";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256")
    .update(verifier, "utf8")
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function openSystemBrowser(url: string): Promise<boolean> {
  const commands: Array<[string, string[]]> =
    process.platform === "darwin"
      ? [["open", [url]]]
      : process.platform === "win32"
        ? [["cmd", ["/c", "start", "", url]]]
        : [["xdg-open", [url]]];

  for (const [command, args] of commands) {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

export async function withLoopbackCallback<T>(
  handler: (
    redirectUri: string,
    waitForCode: () => Promise<{ code: string; state: string | null }>,
  ) => Promise<T>,
): Promise<T> {
  let resolver: ((value: { code: string; state: string | null }) => void) | null = null;
  let rejecter: ((reason?: unknown) => void) | null = null;
  const authCodePromise = new Promise<{ code: string; state: string | null }>((resolve, reject) => {
    resolver = resolve;
    rejecter = reject;
  });

  const server = createServer((req, res) => {
    try {
      const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
      if (requestUrl.pathname !== "/callback") {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }

      const code = requestUrl.searchParams.get("code");
      const state = requestUrl.searchParams.get("state");
      if (!code) {
        res.statusCode = 400;
        res.end("Missing code");
        rejecter?.(
          invalidArgs("oauth_callback_missing_code", "OAuth callback did not include a code."),
        );
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end("<html><body><h1>Livefolio CLI login complete.</h1><p>You can close this window.</p></body></html>");
      resolver?.({ code, state });
    } catch (error) {
      rejecter?.(error);
      res.statusCode = 500;
      res.end("OAuth callback failed");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw internalError("oauth_loopback_failed", "Failed to allocate a loopback callback server.");
  }
  const redirectUri = `http://127.0.0.1:${address.port}/callback`;

  try {
    return await handler(redirectUri, async () => {
      return await Promise.race([
        authCodePromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                invalidArgs(
                  "oauth_timeout",
                  "Timed out waiting for browser login to complete.",
                ),
              ),
            180_000,
          ),
        ),
      ]);
    });
  } finally {
    server.close();
  }
}
