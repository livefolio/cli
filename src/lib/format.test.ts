import { describe, it, expect } from "vitest";
import { formatTable, formatJson, formatCsv } from "./format.js";

const bars = [
  { date: "2025-01-02", value: 478.32 },
  { date: "2025-01-03", value: 479.15 },
  { date: "2025-01-06", value: 1480.01 },
];

describe("formatTable", () => {
  it("formats bars as padded columns", () => {
    const result = formatTable(bars);
    expect(result).toBe(
      [
        "DATE        VALUE",
        "2025-01-02  478.32",
        "2025-01-03  479.15",
        "2025-01-06  1480.01",
      ].join("\n"),
    );
  });

  it("returns empty string for empty array", () => {
    expect(formatTable([])).toBe("");
  });
});

describe("formatJson", () => {
  it("formats bars as JSON array", () => {
    const result = formatJson(bars);
    expect(result).toBe(JSON.stringify(bars, null, 2));
  });

  it("returns empty string for empty array", () => {
    expect(formatJson([])).toBe("");
  });
});

describe("formatCsv", () => {
  it("formats bars as CSV with header", () => {
    const result = formatCsv(bars);
    expect(result).toBe(
      [
        "date,value",
        "2025-01-02,478.32",
        "2025-01-03,479.15",
        "2025-01-06,1480.01",
      ].join("\n"),
    );
  });

  it("returns empty string for empty array", () => {
    expect(formatCsv([])).toBe("");
  });
});
