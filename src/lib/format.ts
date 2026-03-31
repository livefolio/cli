import type { DailyBar } from "@livefolio/sdk";

export function formatTable(bars: DailyBar[]): string {
  if (bars.length === 0) return "";

  const header = "DATE        VALUE";
  const lines = bars.map((b) => {
    const val = String(b.value);
    return `${b.date}  ${val}`;
  });
  return [header, ...lines].join("\n");
}

export function formatJson(bars: DailyBar[]): string {
  if (bars.length === 0) return "";
  return JSON.stringify(bars, null, 2);
}

export function formatCsv(bars: DailyBar[]): string {
  if (bars.length === 0) return "";
  const lines = bars.map((b) => `${b.date},${b.value}`);
  return ["date,value", ...lines].join("\n");
}
