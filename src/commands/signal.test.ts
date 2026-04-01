import { describe, it, expect } from "vitest";
import { parseIndicatorSpec } from "../lib/parse.js";

describe("parseIndicatorSpec", () => {
  it("parses standalone types", () => {
    expect(parseIndicatorSpec("vix")).toEqual({ type: "VIX" });
    expect(parseIndicatorSpec("vix3m")).toEqual({ type: "VIX3M" });
    expect(parseIndicatorSpec("t10y")).toEqual({ type: "T10Y" });
  });

  it("parses ticker-only types", () => {
    expect(parseIndicatorSpec("price SPY")).toEqual({
      type: "Price",
      ticker: "SPY",
    });
  });

  it("parses ticker+lookback types", () => {
    expect(parseIndicatorSpec("sma SPY 200")).toEqual({
      type: "SMA",
      ticker: "SPY",
      lookback: 200,
    });
    expect(parseIndicatorSpec("rsi QQQ 14")).toEqual({
      type: "RSI",
      ticker: "QQQ",
      lookback: 14,
    });
  });

  it("parses ticker with leverage", () => {
    expect(parseIndicatorSpec("price SPY?L=3")).toEqual({
      type: "Price",
      ticker: "SPY",
      leverage: 3,
    });
    expect(parseIndicatorSpec("sma SPY?L=2 50")).toEqual({
      type: "SMA",
      ticker: "SPY",
      leverage: 2,
      lookback: 50,
    });
  });

  it("is case-insensitive for type", () => {
    expect(parseIndicatorSpec("SMA SPY 200")).toEqual({
      type: "SMA",
      ticker: "SPY",
      lookback: 200,
    });
    expect(parseIndicatorSpec("VIX")).toEqual({ type: "VIX" });
  });

  it("parses threshold type", () => {
    expect(parseIndicatorSpec("threshold 30")).toEqual({
      type: "Threshold",
      value: 30,
    });
    expect(parseIndicatorSpec("threshold 0.5")).toEqual({
      type: "Threshold",
      value: 0.5,
    });
  });

  it("throws on unknown type", () => {
    expect(() => parseIndicatorSpec("unknown SPY")).toThrow(
      /unknown indicator type/i,
    );
  });

  it("throws when ticker-only type missing ticker", () => {
    expect(() => parseIndicatorSpec("price")).toThrow(/requires.*ticker/i);
  });

  it("throws when ticker+lookback type missing args", () => {
    expect(() => parseIndicatorSpec("sma SPY")).toThrow(/requires.*lookback/i);
    expect(() => parseIndicatorSpec("sma")).toThrow(/requires.*ticker/i);
  });

  it("throws on invalid lookback", () => {
    expect(() => parseIndicatorSpec("sma SPY abc")).toThrow(
      /positive integer/i,
    );
    expect(() => parseIndicatorSpec("sma SPY 0")).toThrow(/positive integer/i);
    expect(() => parseIndicatorSpec("sma SPY -5")).toThrow(/positive integer/i);
  });

  it("throws on invalid threshold value", () => {
    expect(() => parseIndicatorSpec("threshold")).toThrow(/requires.*value/i);
    expect(() => parseIndicatorSpec("threshold abc")).toThrow(
      /must be a number/i,
    );
  });
});
