import { invalidArgs, internalError, StrategyCommandError } from "../commands/strategy/contract.js";
import {
  normalizeBaseUrl,
  readStoredAuthSession,
  resolveBaseUrl,
  type StoredAuthSession,
  writeStoredAuthSession,
} from "./session.js";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  return await response.json();
}

async function requireSession(baseUrl?: string): Promise<StoredAuthSession> {
  const session = await readStoredAuthSession();
  if (!session) {
    throw invalidArgs("not_authenticated", "Run `livefolio auth login` first.");
  }

  if (!baseUrl) {
    return session;
  }

  const requestedBaseUrl = resolveBaseUrl(baseUrl);
  if (normalizeBaseUrl(session.baseUrl) !== requestedBaseUrl) {
    throw invalidArgs(
      "auth_base_url_mismatch",
      "Stored login is for a different Livefolio base URL.",
      { requestedBaseUrl, sessionBaseUrl: session.baseUrl },
    );
  }

  return session;
}

async function refreshAccessToken(session: StoredAuthSession): Promise<StoredAuthSession> {
  const response = await fetch(`${normalizeBaseUrl(session.baseUrl)}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: session.clientId,
      refresh_token: session.refreshToken,
    }),
  });
  const body = await parseJsonResponse(response);
  if (!response.ok || !body || typeof body !== "object") {
    throw invalidArgs("auth_refresh_failed", "Failed to refresh CLI login.");
  }

  const tokenResponse = body as TokenResponse;
  const refreshed: StoredAuthSession = {
    ...session,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    scope: tokenResponse.scope,
    expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
  };
  await writeStoredAuthSession(refreshed);
  return refreshed;
}

async function getValidAccessToken(baseUrl?: string): Promise<{ baseUrl: string; token: string }> {
  let session = await requireSession(baseUrl);
  const expiresAtMs = new Date(session.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    throw invalidArgs("invalid_auth_session", "Stored auth session is invalid.");
  }
  if (Date.now() >= expiresAtMs - 30_000) {
    session = await refreshAccessToken(session);
  }
  return { baseUrl: session.baseUrl, token: session.accessToken };
}

export async function apiRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    baseUrl?: string;
  } = {},
): Promise<unknown> {
  const { baseUrl, token } = await getValidAccessToken(options.baseUrl);
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });

  const body = await parseJsonResponse(response);
  if (response.ok) {
    return body;
  }

  const message =
    body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string"
      ? (body as { error: string }).error
      : `Request failed with status ${response.status}.`;

  if (response.status === 401) {
    throw invalidArgs("not_authenticated", message);
  }
  if (response.status === 404) {
    throw new StrategyCommandError({
      code: "not_found",
      message,
      exitCode: 3,
    });
  }
  if (response.status >= 400 && response.status < 500) {
    throw invalidArgs("remote_request_failed", message, { status: response.status });
  }
  throw internalError("remote_request_failed", message, { status: response.status });
}
