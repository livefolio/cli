import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  createClient,
  type LivefolioClient,
  type TypedSupabaseClient,
  type Database,
} from "@livefolio/sdk";

export interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  fredApiKey?: string;
}

export function readEnv(): EnvConfig {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push("SUPABASE_URL");
    if (!supabaseAnonKey) missing.push("SUPABASE_ANON_KEY");
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    fredApiKey: process.env.FRED_API_KEY,
  };
}

export function buildClient(env: EnvConfig): LivefolioClient {
  const supabase = createSupabaseClient<Database>(
    env.supabaseUrl,
    env.supabaseAnonKey,
  ) as unknown as TypedSupabaseClient;
  return createClient({ supabase, fredApiKey: env.fredApiKey });
}
