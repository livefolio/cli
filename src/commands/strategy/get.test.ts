import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAction } from "./get.js";

const mockGet = vi.fn();

vi.mock("../../config.js", () => ({
  getLivefolio: () => ({
    strategy: { get: mockGet },
  }),
}));

let stdout = "";
let stderr = "";
let originalExitCode: number | undefined;

beforeEach(() => {
  stdout = "";
  stderr = "";
  originalExitCode = process.exitCode;
  process.exitCode = undefined;
  mockGet.mockReset();
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    stdout += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
    stderr += String(chunk);
    return true;
  });
});

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe("getAction", () => {
  it("returns JSON contract and exit code 3 for not found", async () => {
    mockGet.mockResolvedValue(null);

    await getAction("abc123");

    expect(mockGet).toHaveBeenCalledWith("abc123");
    expect(stderr).toBe("");
    expect(process.exitCode).toBe(3);

    const parsed = JSON.parse(stdout);
    expect(parsed).toEqual({
      ok: false,
      error: {
        code: "strategy_not_found",
        message: "Strategy not found.",
        data: { linkId: "abc123" },
      },
    });
  });

  it("returns JSON contract and exit code 0 on success", async () => {
    const strategy = {
      linkId: "abc123",
      name: "Test Strategy",
      signals: [{ name: "spy_above_200d" }],
      allocations: [{ name: "default", holdings: [{ ticker: { symbol: "SPY", leverage: 1 }, weight: 100 }] }],
    };
    mockGet.mockResolvedValue(strategy);

    await getAction("abc123");

    expect(process.exitCode).toBe(0);
    expect(stderr).toBe("");
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.result.linkId).toBe("abc123");
    expect(parsed.result.strategy.name).toBe("Test Strategy");
  });

  it("maps unexpected errors to exit code 10", async () => {
    mockGet.mockRejectedValue(new Error("Network timeout"));

    await getAction("abc123");

    expect(process.exitCode).toBe(10);
    expect(stderr).toBe("");
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("internal_error");
    expect(parsed.error.data.cause).toContain("Network timeout");
  });
});
