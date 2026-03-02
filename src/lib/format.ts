import type { Observation } from "@livefolio/sdk/market";

export function formatSeries(observations: Observation[]): string {
  const lines = observations.map((o) => `${o.date},${o.value}`);
  return ["date,value", ...lines].join("\n");
}