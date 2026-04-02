import { describe, it, expect } from "vitest";
import { resolveType, parseTicker } from "./indicator";

describe("resolveType", () => {
  it("maps lowercase to SDK enum value", () => {
    expect(resolveType("sma")).toBe("SMA");
    expect(resolveType("ema")).toBe("EMA");
    expect(resolveType("rsi")).toBe("RSI");
    expect(resolveType("price")).toBe("Price");
    expect(resolveType("return")).toBe("Return");
    expect(resolveType("volatility")).toBe("Volatility");
    expect(resolveType("drawdown")).toBe("Drawdown");
    expect(resolveType("vix")).toBe("VIX");
    expect(resolveType("vix3m")).toBe("VIX3M");
    expect(resolveType("t10y")).toBe("T10Y");
    expect(resolveType("t3m")).toBe("T3M");
  });

  it("is case-insensitive", () => {
    expect(resolveType("SMA")).toBe("SMA");
    expect(resolveType("Sma")).toBe("SMA");
    expect(resolveType("VIX3M")).toBe("VIX3M");
  });

  it("returns null for unknown types", () => {
    expect(resolveType("unknown")).toBeNull();
    expect(resolveType("threshold")).toBeNull();
    expect(resolveType("month")).toBeNull();
  });
});

describe("parseTicker", () => {
  it("returns symbol only when no params", () => {
    expect(parseTicker("SPY")).toEqual({ symbol: "SPY" });
  });

  it("parses leverage from ?L=N", () => {
    expect(parseTicker("SPY?L=3")).toEqual({ symbol: "SPY", leverage: 3 });
    expect(parseTicker("QQQ?L=2")).toEqual({ symbol: "QQQ", leverage: 2 });
  });

  it("ignores unknown params", () => {
    expect(parseTicker("SPY?foo=bar")).toEqual({ symbol: "SPY" });
  });

  it("throws on invalid leverage", () => {
    expect(() => parseTicker("SPY?L=0")).toThrow(/positive integer/);
    expect(() => parseTicker("SPY?L=-1")).toThrow(/positive integer/);
    expect(() => parseTicker("SPY?L=abc")).toThrow(/positive integer/);
    expect(() => parseTicker("SPY?L=1.5")).toThrow(/positive integer/);
  });
});
