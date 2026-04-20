import { createServer } from "node:http";
import { exec } from "node:child_process";
import { buildAuthorizationUrl, exchangeCodeForTokens } from "@livefolio/sdk/auth";
import { getSupabaseUrl, getOAuthClientId } from "../../config.js";
import { saveSession } from "../../lib/session.js";
export const REDIRECT_PORT = 12345;
export const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

export async function loginAction(): Promise<void> {
  const supabaseUrl = getSupabaseUrl();
  const { url, pkce } = buildAuthorizationUrl(supabaseUrl, {
    clientId: getOAuthClientId(),
    redirectUri: REDIRECT_URI,
  });

  let code: string;
  try {
    code = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error("Login timed out after 120 seconds"));
      }, 120_000);

      const server = createServer((req, res) => {
        const reqUrl = new URL(req.url ?? "", `http://localhost:${REDIRECT_PORT}`);

        if (reqUrl.pathname !== "/callback") {
          res.writeHead(404);
          res.end();
          return;
        }

        const authCode = reqUrl.searchParams.get("code");
        if (!authCode) {
          res.writeHead(400);
          res.end("Missing code parameter");
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Login successful!</h1><p>You can close this tab.</p></body></html>",
        );
        clearTimeout(timeout);
        server.close();
        resolve(authCode);
      });

      server.listen(REDIRECT_PORT, () => {
        process.stderr.write(
          `Opening browser for login...\nIf it doesn't open, visit: ${url}\n`,
        );
        const cmd =
          process.platform === "darwin"
            ? "open"
            : process.platform === "win32"
              ? "start"
              : "xdg-open";
        exec(`${cmd} '${url}'`, () => {
          // browser-open errors are non-fatal — URL is already printed above
        });
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(
      supabaseUrl,
      code,
      pkce.codeVerifier,
      getOAuthClientId(),
      REDIRECT_URI,
    );
    saveSession(tokens);
    console.log("Logged in successfully");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
