import { describe, it, expect } from "vitest";
import { parseSignalSpec, parseIndicatorSpec } from "./parse";

describe("parseIndicatorSpec", () => {
  it("parses delay on ticker-lookback indicator", () => {
    expect(parseIndicatorSpec("SMA SPY 50 @5")).toEqual({
      type: "SMA",
      ticker: "SPY",
      lookback: 50,
      delay: 5,
    });
  });

  it("parses negative delay", () => {
    expect(parseIndicatorSpec("EMA SPY 20 @-3")).toEqual({
      type: "EMA",
      ticker: "SPY",
      lookback: 20,
      delay: -3,
    });
  });

  it("parses standalone indicator with delay", () => {
    expect(parseIndicatorSpec("VIX @2")).toEqual({
      type: "VIX",
      delay: 2,
    });
  });

  it("parses price indicator with delay", () => {
    expect(parseIndicatorSpec("Price SPY @1")).toEqual({
      type: "Price",
      ticker: "SPY",
      delay: 1,
    });
  });

  it("returns no delay field when @suffix absent", () => {
    expect(parseIndicatorSpec("SMA SPY 50")).toEqual({
      type: "SMA",
      ticker: "SPY",
      lookback: 50,
    });
  });

  it("throws on non-integer delay", () => {
    expect(() => parseIndicatorSpec("SMA SPY 50 @1.5")).toThrow(
      /delay must be an integer/i,
    );
  });

  it("throws on invalid delay value", () => {
    expect(() => parseIndicatorSpec("SMA SPY 50 @abc")).toThrow(
      /delay must be an integer/i,
    );
  });
});

describe("parseSignalSpec", () => {
  it("parses greater-than signal", () => {
    expect(parseSignalSpec("SMA SPY 50 > SMA SPY 200")).toEqual({
      indicator1: { type: "SMA", ticker: "SPY", lookback: 50 },
      indicator2: { type: "SMA", ticker: "SPY", lookback: 200 },
      comparison: ">",
      tolerance: 0,
    });
  });

  it("parses less-than signal", () => {
    expect(parseSignalSpec("RSI SPY 14 < Threshold 30")).toEqual({
      indicator1: { type: "RSI", ticker: "SPY", lookback: 14 },
      indicator2: { type: "Threshold", value: 30 },
      comparison: "<",
      tolerance: 0,
    });
  });

  it("parses equals signal", () => {
    expect(parseSignalSpec("VIX = Threshold 20")).toEqual({
      indicator1: { type: "VIX" },
      indicator2: { type: "Threshold", value: 20 },
      comparison: "=",
      tolerance: 0,
    });
  });

  it("parses standalone indicators", () => {
    expect(parseSignalSpec("VIX > VIX3M")).toEqual({
      indicator1: { type: "VIX" },
      indicator2: { type: "VIX3M" },
      comparison: ">",
      tolerance: 0,
    });
  });

  it("parses ticker with leverage", () => {
    expect(parseSignalSpec("Price SPY?L=3 > SMA SPY?L=3 200")).toEqual({
      indicator1: { type: "Price", ticker: "SPY", leverage: 3 },
      indicator2: { type: "SMA", ticker: "SPY", leverage: 3, lookback: 200 },
      comparison: ">",
      tolerance: 0,
    });
  });

  it("throws on missing operator", () => {
    expect(() => parseSignalSpec("SMA SPY 50 SMA SPY 200")).toThrow(
      /invalid signal spec/i,
    );
  });

  it("throws on missing indicator before operator", () => {
    expect(() => parseSignalSpec("> SMA SPY 200")).toThrow(
      /invalid signal spec/i,
    );
  });

  it("throws on missing indicator after operator", () => {
    expect(() => parseSignalSpec("SMA SPY 50 >")).toThrow(
      /invalid signal spec/i,
    );
  });

  it("throws on invalid indicator in signal", () => {
    expect(() => parseSignalSpec("unknown SPY > SMA SPY 200")).toThrow(
      /unknown indicator type/i,
    );
  });

  it("parses signal with integer tolerance", () => {
    expect(parseSignalSpec("SMA SPY 50 > SMA SPY 200 ~2")).toEqual({
      indicator1: { type: "SMA", ticker: "SPY", lookback: 50 },
      indicator2: { type: "SMA", ticker: "SPY", lookback: 200 },
      comparison: ">",
      tolerance: 2,
    });
  });

  it("parses signal with float tolerance", () => {
    expect(parseSignalSpec("RSI SPY 14 < Threshold 30 ~0.5")).toEqual({
      indicator1: { type: "RSI", ticker: "SPY", lookback: 14 },
      indicator2: { type: "Threshold", value: 30 },
      comparison: "<",
      tolerance: 0.5,
    });
  });

  it("defaults tolerance to 0 when not specified", () => {
    expect(parseSignalSpec("VIX > VIX3M")).toEqual({
      indicator1: { type: "VIX" },
      indicator2: { type: "VIX3M" },
      comparison: ">",
      tolerance: 0,
    });
  });

  it("parses combined delay on indicator and tolerance on signal", () => {
    expect(parseSignalSpec("SMA SPY 50 @3 > SMA SPY 200 ~1")).toEqual({
      indicator1: { type: "SMA", ticker: "SPY", lookback: 50, delay: 3 },
      indicator2: { type: "SMA", ticker: "SPY", lookback: 200 },
      comparison: ">",
      tolerance: 1,
    });
  });

  it("parses delay on indicator2 combined with tolerance", () => {
    expect(parseSignalSpec("VIX > VIX3M @2 ~0.1")).toEqual({
      indicator1: { type: "VIX" },
      indicator2: { type: "VIX3M", delay: 2 },
      comparison: ">",
      tolerance: 0.1,
    });
  });

  it("throws on negative tolerance", () => {
    expect(() => parseSignalSpec("VIX > VIX3M ~-1")).toThrow(
      /tolerance must be non-negative/i,
    );
  });

  it("throws on invalid tolerance value", () => {
    expect(() => parseSignalSpec("VIX > VIX3M ~abc")).toThrow(
      /tolerance must be a number/i,
    );
  });
});
