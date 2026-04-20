import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createLivefolioClient, type LivefolioClient, type TypedSupabaseClient } from "@livefolio/sdk";
import { refreshAccessToken } from "@livefolio/sdk/auth";
import { loadSession, saveSession, isExpired } from "./lib/session.js";

export function getOAuthClientId(): string {
  const id = process.env.OAUTH_CLIENT_ID;
  if (!id) {
    process.stderr.write("Error: OAUTH_CLIENT_ID is not set. Add it to your .env file.\n");
    process.exit(1);
  }
  return id;
}

export function loadEnvFile(filePath: string): void {
  const content = readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    process.stderr.write("Error: SUPABASE_URL is not set. Use --env or export it.\n");
    process.exit(1);
  }
  return url;
}

let client: LivefolioClient | null = null;

export function getLivefolio(): LivefolioClient {
  if (!client) {
    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_ANON_KEY;
    if (!key) {
      process.stderr.write("Error: SUPABASE_ANON_KEY is not set. Use --env or export it.\n");
      process.exit(1);
    }

    const supabase = createClient(url, key) as unknown as TypedSupabaseClient;
    client = createLivefolioClient(supabase, { supabaseUrl: url });
  }
  return client;
}

export async function requireAuth(): Promise<void> {
  const session = loadSession();
  if (!session) {
    process.stderr.write("Error: Not logged in. Run: livefolio auth login\n");
    process.exit(1);
  }

  let accessToken = session.accessToken;
  let refreshToken = session.refreshToken;

  if (isExpired(session)) {
    try {
      const refreshed = await refreshAccessToken(
        getSupabaseUrl(),
        session.refreshToken,
        getOAuthClientId(),
      );
      saveSession(refreshed);
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken;
    } catch {
      process.stderr.write(
        "Error: Session expired. Run: livefolio auth login\n",
      );
      process.exit(1);
    }
  }

  const lf = getLivefolio();
  await lf.supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
}
