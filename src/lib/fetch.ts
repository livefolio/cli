import { loadConfig } from "../config.js";

export async function invokeEdgeFunction<T>(
  functionName: string,
  body: unknown,
): Promise<T> {
  const { supabaseUrl, supabaseAnonKey } = loadConfig();
  const url = `${supabaseUrl}/functions/v1/${functionName}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch {
      // use default message
    }
    throw new Error(`Edge function "${functionName}" failed: ${message}`);
  }

  return (await res.json()) as T;
}
