import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateAction } from "./evaluate.js";

const mockEvaluate = vi.fn();

vi.mock("../../config.js", () => ({
  getLivefolio: () => ({
    strategy: { evaluate: mockEvaluate },
  }),
}));

const validDraft = {
  name: "Trend + Safety",
  trading: { frequency: "Monthly", offset: 0 },
  signals: [
    {
      name: "spy_above_200d",
      signal: {
        left: { type: "Price", ticker: { symbol: "SPY", leverage: 1 }, lookback: 1, delay: 0, unit: "$", threshold: null },
        comparison: ">",
        right: { type: "SMA", ticker: { symbol: "SPY", leverage: 1 }, lookback: 200, delay: 0, unit: "$", threshold: null },
        tolerance: 0,
      },
    },
  ],
  allocations: [
    {
      name: "risk_on",
      condition: { kind: "signal", signalName: "spy_above_200d" },
      holdings: [{ ticker: { symbol: "SPY", leverage: 1 }, weight: 100 }],
    },
  ],
};

let stdout = "";
let stderr = "";
let originalExitCode: number | undefined;

beforeEach(() => {
  stdout = "";
  stderr = "";
  originalExitCode = process.exitCode;
  process.exitCode = undefined;
  mockEvaluate.mockReset();
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

async function writeDraftFile(contents: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "livefolio-cli-"));
  const file = join(dir, "strategy.json");
  await writeFile(file, JSON.stringify(contents), "utf8");
  return file;
}

describe("evaluateAction (local file)", () => {
  it("returns structured evaluation output on success", async () => {
    const file = await writeDraftFile(validDraft);
    mockEvaluate.mockResolvedValue({
      asOf: new Date("2025-06-15T12:00:00.000Z"),
      allocation: { name: "risk_on", holdings: [{ ticker: { symbol: "SPY", leverage: 1 }, weight: 100 }] },
      signals: { key: true },
      indicators: { ind: { timestamp: "2025-06-15T16:00:00.000Z", value: 590 } },
    });

    await evaluateAction({ file, at: "2025-06-15" });

    expect(process.exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(mockEvaluate).toHaveBeenCalledWith(
      expect.objectContaining({ linkId: "local-trend-safety", name: "Trend + Safety" }),
      new Date("2025-06-15"),
    );

    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.result.file).toBe(file);
    expect(parsed.result.evaluation.allocation.name).toBe("risk_on");
  });

  it("returns exit code 2 for invalid --at date", async () => {
    const file = await writeDraftFile(validDraft);

    await evaluateAction({ file, at: "not-a-date" });

    expect(process.exitCode).toBe(2);
    expect(stderr).toBe("");
    expect(mockEvaluate).not.toHaveBeenCalled();
    const parsed = JSON.parse(stdout);
    expect(parsed.error.code).toBe("invalid_date");
  });

  it("returns exit code 4 for compile failures", async () => {
    const bad = {
      ...validDraft,
      allocations: [{
        name: "broken",
        condition: { kind: "signal", signalName: "missing_signal" },
        holdings: [{ ticker: { symbol: "SPY", leverage: 1 }, weight: 100 }],
      }],
    };
    const file = await writeDraftFile(bad);

    await evaluateAction({ file });

    expect(process.exitCode).toBe(4);
    expect(stderr).toBe("");
    const parsed = JSON.parse(stdout);
    expect(parsed.error.code).toBe("compile_failed");
  });
});
