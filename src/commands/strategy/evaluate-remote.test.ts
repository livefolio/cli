import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateRemoteAction } from "./evaluate-remote.js";

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

describe("evaluateRemoteAction", () => {
  it("returns exit code 2 for invalid date", async () => {
    await evaluateRemoteAction("abc123", { at: "bad-date" });

    expect(process.exitCode).toBe(2);
    expect(mockApiRequest).not.toHaveBeenCalled();
    expect(stderr).toBe("");
    const parsed = JSON.parse(stdout);
    expect(parsed.error.code).toBe("invalid_date");
  });

  it("returns exit code 3 when remote strategy is missing", async () => {
    mockApiRequest.mockResolvedValue({});

    await evaluateRemoteAction("abc123", {});

    expect(process.exitCode).toBe(3);
    expect(stderr).toBe("");
    const parsed = JSON.parse(stdout);
    expect(parsed.error.code).toBe("strategy_not_found");
  });

  it("returns success envelope on evaluation", async () => {
    const evaluation = { asOf: new Date("2025-06-15T12:00:00.000Z"), allocation: {}, signals: {}, indicators: {} };
    mockApiRequest.mockResolvedValue({ evaluation });

    await evaluateRemoteAction("abc123", { at: "2025-06-15" });

    expect(process.exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(mockApiRequest).toHaveBeenCalledWith(
      "/api/strategy/abc123/evaluate?at=2025-06-15T00%3A00%3A00.000Z",
    );

    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.result.linkId).toBe("abc123");
  });
});
