// TODO: Replace file:../sdk with published @livefolio/sdk once it's on npm
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createLivefolioClient, type LivefolioClient, type TypedSupabaseClient } from "@livefolio/sdk";

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

let client: LivefolioClient | null = null;

export function getLivefolio(): LivefolioClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_ANON_KEY must be set. " +
        "Use --env <path> to load a .env file, or export them in your shell.",
      );
    }

    const supabase = createClient(url, key) as unknown as TypedSupabaseClient;
    client = createLivefolioClient(supabase);
  }
  return client;
}
