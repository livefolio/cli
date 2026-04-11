import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient, type LivefolioClient } from "@livefolio/sdk";
import { createYahooFredMarket } from "@livefolio/market";
import { createSupabaseStorage, type Database } from "@livefolio/storage";

export interface EnvConfig {
  supabaseUrl: string;
  supabaseKey: string;
  fredApiKey?: string;
}

export function readEnv(): EnvConfig {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push("SUPABASE_URL");
    if (!supabaseKey) missing.push("SUPABASE_KEY");
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  return {
    supabaseUrl,
    supabaseKey,
    fredApiKey: process.env.FRED_API_KEY,
  };
}

export function buildClient(env: EnvConfig): LivefolioClient {
  const supabase = createSupabaseClient<Database>(
    env.supabaseUrl,
    env.supabaseKey,
  );
  const storage = createSupabaseStorage(supabase);
  const market = createYahooFredMarket({ fredApiKey: env.fredApiKey! });

  return createClient({ storage, market });
}
