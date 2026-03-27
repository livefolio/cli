import { invalidArgs, runStrategyAction } from "../strategy/contract.js";
import { openSystemBrowser, pkceChallenge, randomToken, withLoopbackCallback } from "../../auth/oauth.js";
import { resolveBaseUrl, writeStoredAuthSession } from "../../auth/session.js";

interface RegisterResponse {
  client_id: string;
  scope: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw invalidArgs("oauth_request_failed", `OAuth request failed with status ${response.status}.`);
  }
  return (await response.json()) as T;
}

async function exchangeToken(baseUrl: string, params: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(`${baseUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  if (!response.ok) {
    throw invalidArgs("oauth_token_exchange_failed", `Token exchange failed with status ${response.status}.`);
  }
  return (await response.json()) as TokenResponse;
}

export async function loginAction(options: { baseUrl?: string; open?: boolean }): Promise<void> {
  await runStrategyAction(async () => {
    const baseUrl = resolveBaseUrl(options.baseUrl);
    return await withLoopbackCallback(async (redirectUri, waitForCode) => {
      const register = await postJson<RegisterResponse>(`${baseUrl}/register`, {
        client_name: "Livefolio CLI",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        scope: "broker:read",
      });

      const state = randomToken(24);
      const codeVerifier = randomToken(48);
      const codeChallenge = pkceChallenge(codeVerifier);
      const authorizeUrl = new URL(`${baseUrl}/authorize`);
      authorizeUrl.searchParams.set("response_type", "code");
      authorizeUrl.searchParams.set("client_id", register.client_id);
      authorizeUrl.searchParams.set("redirect_uri", redirectUri);
      authorizeUrl.searchParams.set("scope", register.scope);
      authorizeUrl.searchParams.set("state", state);
      authorizeUrl.searchParams.set("code_challenge", codeChallenge);
      authorizeUrl.searchParams.set("code_challenge_method", "S256");

      const openedBrowser = options.open !== false
        ? await openSystemBrowser(authorizeUrl.toString())
        : false;
      if (!openedBrowser) {
        process.stderr.write(`Open this URL to finish login:\n${authorizeUrl.toString()}\n`);
      }

      const callback = await waitForCode();
      if (callback.state !== state) {
        throw invalidArgs("oauth_state_mismatch", "OAuth login state did not match.");
      }

      const token = await exchangeToken(baseUrl, {
        grant_type: "authorization_code",
        client_id: register.client_id,
        code: callback.code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      });

      await writeStoredAuthSession({
        baseUrl,
        clientId: register.client_id,
        scope: token.scope,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      });

      return {
        baseUrl,
        clientId: register.client_id,
        scope: token.scope,
        openedBrowser,
      };
    });
  });
}
