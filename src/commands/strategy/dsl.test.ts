import { describe, expect, it } from "vitest";
import {
  parseConditionDsl,
  parseHoldingDsl,
  parseIndicatorDsl,
} from "./dsl.js";

describe("parseIndicatorDsl", () => {
  it("parses Price with default lookback", () => {
    const parsed = parseIndicatorDsl("Price(SPY)");
    expect(parsed).toMatchObject({
      type: "Price",
      ticker: { symbol: "SPY", leverage: 1 },
      lookback: 1,
      delay: 0,
      threshold: null,
    });
  });

  it("parses Threshold indicator", () => {
    const parsed = parseIndicatorDsl("Threshold(0)");
    expect(parsed.type).toBe("Threshold");
    expect(parsed.threshold).toBe(0);
  });
});

describe("parseHoldingDsl", () => {
  it("parses leveraged holding syntax", () => {
    const parsed = parseHoldingDsl("UPRO?L=3:100");
    expect(parsed).toEqual({
      ticker: { symbol: "UPRO", leverage: 3 },
      weight: 100,
    });
  });
});

describe("parseConditionDsl", () => {
  it("enforces NOT > AND > OR precedence", () => {
    const parsed = parseConditionDsl("a AND NOT b OR c");
    expect(parsed).toEqual({
      kind: "or",
      args: [
        {
          kind: "and",
          args: [
            { kind: "signal", signalName: "a" },
            { kind: "not", signalName: "b" },
          ],
        },
        {
          kind: "and",
          args: [{ kind: "signal", signalName: "c" }],
        },
      ],
    });
  });

  it("supports parenthesized groups", () => {
    const parsed = parseConditionDsl("(a AND b) OR c");
    expect(parsed).toEqual({
      kind: "or",
      args: [
        {
          kind: "and",
          args: [
            { kind: "signal", signalName: "a" },
            { kind: "signal", signalName: "b" },
          ],
        },
        {
          kind: "and",
          args: [{ kind: "signal", signalName: "c" }],
        },
      ],
    });
  });

  it("rejects invalid tokens", () => {
    expect(() => parseConditionDsl("a AND b$")).toThrow(/Condition contains an invalid token/);
  });

  it("rejects malformed expressions", () => {
    expect(() => parseConditionDsl("a OR")).toThrow(/Unexpected end of expression/);
  });
});

