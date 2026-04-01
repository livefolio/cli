import { describe, it, expect } from "vitest";
import { parseSignalSpec } from "./parse.js";

describe("parseSignalSpec", () => {
  it("parses greater-than signal", () => {
    expect(parseSignalSpec("SMA SPY 50 > SMA SPY 200")).toEqual({
      indicator1: { type: "SMA", ticker: "SPY", lookback: 50 },
      indicator2: { type: "SMA", ticker: "SPY", lookback: 200 },
      comparison: ">",
    });
  });

  it("parses less-than signal", () => {
    expect(parseSignalSpec("RSI SPY 14 < Threshold 30")).toEqual({
      indicator1: { type: "RSI", ticker: "SPY", lookback: 14 },
      indicator2: { type: "Threshold", value: 30 },
      comparison: "<",
    });
  });

  it("parses equals signal", () => {
    expect(parseSignalSpec("VIX = Threshold 20")).toEqual({
      indicator1: { type: "VIX" },
      indicator2: { type: "Threshold", value: 20 },
      comparison: "=",
    });
  });

  it("parses standalone indicators", () => {
    expect(parseSignalSpec("VIX > VIX3M")).toEqual({
      indicator1: { type: "VIX" },
      indicator2: { type: "VIX3M" },
      comparison: ">",
    });
  });

  it("parses ticker with leverage", () => {
    expect(parseSignalSpec("Price SPY?L=3 > SMA SPY?L=3 200")).toEqual({
      indicator1: { type: "Price", ticker: "SPY", leverage: 3 },
      indicator2: { type: "SMA", ticker: "SPY", leverage: 3, lookback: 200 },
      comparison: ">",
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
});
