import { describe, it, expect } from "vitest";
import {
  parseStrategyJson,
  formatHoldings,
  filterChangesOnly,
} from "./strategy.js";

describe("parseStrategyJson", () => {
  it("parses a valid strategy with all fields", () => {
    const input = JSON.stringify({
      name: "Golden Cross",
      freq: "Monthly",
      offset: 1,
      rules: [
        {
          when: ["SMA SPY 50 > SMA SPY 200"],
          hold: { SPY: 0.6, CASHX: 0.4 },
        },
        { hold: { CASHX: 1 } },
      ],
    });
    const result = parseStrategyJson(input);
    expect(result.name).toBe("Golden Cross");
    expect(result.freq).toBe("Monthly");
    expect(result.offset).toBe(1);
    expect(result.rules).toHaveLength(2);
    expect(result.rules[0].signals).toHaveLength(1);
    expect(result.rules[0].signals[0]).toEqual({
      indicator1: { type: "SMA", ticker: "SPY", lookback: 50 },
      indicator2: { type: "SMA", ticker: "SPY", lookback: 200 },
      comparison: ">",
      tolerance: 0,
    });
    expect(result.rules[0].hold).toEqual({ SPY: 0.6, CASHX: 0.4 });
    expect(result.rules[1].signals).toEqual([]);
    expect(result.rules[1].hold).toEqual({ CASHX: 1 });
  });

  it("applies defaults for freq and offset", () => {
    const input = JSON.stringify({
      name: "Simple",
      rules: [{ hold: { CASHX: 1 } }],
    });
    const result = parseStrategyJson(input);
    expect(result.freq).toBe("Daily");
    expect(result.offset).toBe(0);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseStrategyJson("not json")).toThrow(/invalid json/i);
  });

  it("throws on missing name", () => {
    const input = JSON.stringify({ rules: [{ hold: { CASHX: 1 } }] });
    expect(() => parseStrategyJson(input)).toThrow(/name.*required/i);
  });

  it("throws on missing rules", () => {
    const input = JSON.stringify({ name: "Test" });
    expect(() => parseStrategyJson(input)).toThrow(/rules.*required/i);
  });

  it("throws on empty rules array", () => {
    const input = JSON.stringify({ name: "Test", rules: [] });
    expect(() => parseStrategyJson(input)).toThrow(/at least one rule/i);
  });

  it("throws when last rule has when clause", () => {
    const input = JSON.stringify({
      name: "Test",
      rules: [{ when: ["VIX > Threshold 20"], hold: { CASHX: 1 } }],
    });
    expect(() => parseStrategyJson(input)).toThrow(/last rule.*fallback/i);
  });

  it("throws when non-last rule has no when clause", () => {
    const input = JSON.stringify({
      name: "Test",
      rules: [{ hold: { SPY: 1 } }, { hold: { CASHX: 1 } }],
    });
    expect(() => parseStrategyJson(input)).toThrow(
      /non-fallback.*must have.*when/i,
    );
  });

  it("throws on missing hold", () => {
    const input = JSON.stringify({
      name: "Test",
      rules: [{ when: ["VIX > Threshold 20"] }],
    });
    expect(() => parseStrategyJson(input)).toThrow(/hold.*required/i);
  });

  it("throws when hold weights do not sum to 1", () => {
    const input = JSON.stringify({
      name: "Test",
      rules: [{ hold: { SPY: 0.3, CASHX: 0.2 } }],
    });
    expect(() => parseStrategyJson(input)).toThrow(/weights must sum to 1/i);
  });

  it("throws on invalid freq", () => {
    const input = JSON.stringify({
      name: "Test",
      freq: "Biweekly",
      rules: [{ hold: { CASHX: 1 } }],
    });
    expect(() => parseStrategyJson(input)).toThrow(/freq/i);
  });

  it("throws on invalid signal spec in when", () => {
    const input = JSON.stringify({
      name: "Test",
      rules: [
        { when: ["bad signal string"], hold: { SPY: 1 } },
        { hold: { CASHX: 1 } },
      ],
    });
    expect(() => parseStrategyJson(input)).toThrow(/invalid signal spec/i);
  });

  it("parses strategy with signal tolerance", () => {
    const input = JSON.stringify({
      name: "Tolerant",
      rules: [
        {
          when: ["SMA SPY 50 > SMA SPY 200 ~2"],
          hold: { SPY: 1 },
        },
        { hold: { CASHX: 1 } },
      ],
    });
    const result = parseStrategyJson(input);
    expect(result.rules[0].signals[0].tolerance).toBe(2);
  });

  it("parses strategy with signal delay and tolerance", () => {
    const input = JSON.stringify({
      name: "Full",
      rules: [
        {
          when: ["Price SPY @1 > SMA SPY 200 ~2"],
          hold: { SPY: 1 },
        },
        { hold: { CASHX: 1 } },
      ],
    });
    const result = parseStrategyJson(input);
    expect(result.rules[0].signals[0].indicator1.delay).toBe(1);
    expect(result.rules[0].signals[0].tolerance).toBe(2);
  });

  it("parses hold with leveraged ticker", () => {
    const input = JSON.stringify({
      name: "Leveraged",
      rules: [{ hold: { "SPY?L=3": 0.5, CASHX: 0.5 } }],
    });
    const result = parseStrategyJson(input);
    expect(result.rules[0].hold).toEqual({ "SPY?L=3": 0.5, CASHX: 0.5 });
  });

  it("parses multiple signals in when array", () => {
    const input = JSON.stringify({
      name: "Multi",
      rules: [
        {
          when: ["SMA SPY 50 > SMA SPY 200", "RSI SPY 14 < Threshold 70"],
          hold: { SPY: 1 },
        },
        { hold: { CASHX: 1 } },
      ],
    });
    const result = parseStrategyJson(input);
    expect(result.rules[0].signals).toHaveLength(2);
  });
});

describe("formatHoldings", () => {
  it("formats single holding as TICKER:NN%", () => {
    const holdings: [{ symbol: string; leverage: number }, number][] = [
      [{ symbol: "CASHX", leverage: 1 }, 1],
    ];
    expect(formatHoldings(holdings)).toBe("CASHX:100%");
  });

  it("formats multiple holdings joined by comma-space", () => {
    const holdings: [{ symbol: string; leverage: number }, number][] = [
      [{ symbol: "AAPL", leverage: 1 }, 0.6],
      [{ symbol: "MSFT", leverage: 1 }, 0.4],
    ];
    expect(formatHoldings(holdings)).toBe("AAPL:60%, MSFT:40%");
  });

  it("includes leverage when not 1", () => {
    const holdings: [{ symbol: string; leverage: number }, number][] = [
      [{ symbol: "SPY", leverage: 3 }, 0.5],
      [{ symbol: "CASHX", leverage: 1 }, 0.5],
    ];
    expect(formatHoldings(holdings)).toBe("SPY?L=3:50%, CASHX:50%");
  });

  it("rounds percentages to nearest integer", () => {
    const holdings: [{ symbol: string; leverage: number }, number][] = [
      [{ symbol: "SPY", leverage: 1 }, 0.333],
      [{ symbol: "QQQ", leverage: 1 }, 0.667],
    ];
    expect(formatHoldings(holdings)).toBe("SPY:33%, QQQ:67%");
  });
});

describe("filterChangesOnly", () => {
  function bar(
    date: string,
    holdings: [{ symbol: string; leverage: number }, number][],
  ) {
    return { date, holdings };
  }

  it("returns empty array for empty input", () => {
    expect(filterChangesOnly([])).toEqual([]);
  });

  it("always includes the first row", () => {
    const bars = [bar("2024-01-01", [[{ symbol: "SPY", leverage: 1 }, 1]])];
    expect(filterChangesOnly(bars)).toEqual(bars);
  });

  it("filters out consecutive identical allocations", () => {
    const h = [[{ symbol: "SPY", leverage: 1 }, 1]] as [
      { symbol: string; leverage: number },
      number,
    ][];
    const bars = [
      bar("2024-01-01", h),
      bar("2024-01-02", h),
      bar("2024-01-03", h),
    ];
    const result = filterChangesOnly(bars);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2024-01-01");
  });

  it("includes rows where allocation changes", () => {
    const h1 = [[{ symbol: "SPY", leverage: 1 }, 1]] as [
      { symbol: string; leverage: number },
      number,
    ][];
    const h2 = [[{ symbol: "CASHX", leverage: 1 }, 1]] as [
      { symbol: string; leverage: number },
      number,
    ][];
    const bars = [
      bar("2024-01-01", h1),
      bar("2024-01-02", h1),
      bar("2024-01-03", h2),
    ];
    const result = filterChangesOnly(bars);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2024-01-01");
    expect(result[1].date).toBe("2024-01-03");
  });
});
