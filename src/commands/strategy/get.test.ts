import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAction } from "./get.js";

const mockApiRequest = vi.fn();

vi.mock("../../auth/api.js", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

let stdout = "";
let stderr = "";
let originalExitCode: number | undefined;

beforeEach(() => {
  stdout = "";
  stderr = "";
  originalExitCode = process.exitCode;
  process.exitCode = undefined;
  mockApiRequest.mockReset();
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
    mockApiRequest.mockResolvedValue({});

    await getAction("abc123");

    expect(mockApiRequest).toHaveBeenCalledWith("/api/strategy/abc123");
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
    mockApiRequest.mockResolvedValue({ strategy });

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
    mockApiRequest.mockRejectedValue(new Error("Network timeout"));

    await getAction("abc123");

    expect(process.exitCode).toBe(10);
    expect(stderr).toBe("");
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("internal_error");
    expect(parsed.error.data.cause).toContain("Network timeout");
  });
});
