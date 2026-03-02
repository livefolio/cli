import type { Observation } from "@livefolio/sdk/market";

export function formatObservations(
  data: Record<string, Observation[]>,
  symbols: string[]
): string {
  const lines: string[] = [];
  for (const s of symbols) {
    for (const o of data[s] ?? []) {
      lines.push(`${s},${o.timestamp},${o.value}`);
    }
  }
  return ["symbol,timestamp,price", ...lines].join("\n");
}
