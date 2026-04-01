import type { DailyBar } from "@livefolio/sdk";

export function formatTable(bars: DailyBar[]): string {
  if (bars.length === 0) return "";

  const vals = bars.map((b) => String(b.value));
  const valWidth = Math.max(5, ...vals.map((v) => v.length));
  const dateWidth = 10;

  const h = "─";
  const topBorder = `┌${h.repeat(dateWidth + 2)}┬${h.repeat(valWidth + 2)}┐`;
  const midBorder = `├${h.repeat(dateWidth + 2)}┼${h.repeat(valWidth + 2)}┤`;
  const botBorder = `└${h.repeat(dateWidth + 2)}┴${h.repeat(valWidth + 2)}┘`;
  const header = `│ ${"DATE".padEnd(dateWidth)} │ ${"VALUE".padEnd(valWidth)} │`;
  const rows = bars.map((b, i) => {
    return `│ ${b.date} │ ${vals[i].padStart(valWidth)} │`;
  });

  return [topBorder, header, midBorder, ...rows, botBorder].join("\n");
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
