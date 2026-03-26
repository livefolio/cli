import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addAllocationAction } from "./add-allocation.js";
import { backtestAction } from "./backtest.js";
import { compileAction } from "./compile.js";
import { setTradingAction } from "./set-trading.js";
import { validateAction } from "./validate.js";

const mockBacktest = vi.fn();

vi.mock("../../config.js", () => ({
  getLivefolio: () => ({
    strategy: {
      backtest: mockBacktest,
    },
  }),
}));

const baseDraft = {
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
  mockBacktest.mockReset();
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

describe("strategy command contract", () => {
  it("validate emits JSON-only success envelope", async () => {
    const file = await writeDraftFile(baseDraft);

    await validateAction({ file });

    expect(process.exitCode).toBe(0);
    expect(stderr).toBe("");
    const parsed = JSON.parse(stdout);
    expect(parsed).toEqual({
      ok: true,
      result: {
        file,
        valid: true,
      },
      warnings: [],
    });
  });

  it("compile emits stable schema with compiled strategy", async () => {
    const file = await writeDraftFile(baseDraft);

    await compileAction({ file });

    expect(process.exitCode).toBe(0);
    expect(stderr).toBe("");
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.result.file).toBe(file);
    expect(parsed.result.strategy.linkId).toBe("local-trend-safety");
    expect(parsed.result.strategy.allocations[0].name).toBe("risk_on");
  });

  it("backtest emits JSON-only success envelope", async () => {
    const file = await writeDraftFile(baseDraft);
    mockBacktest.mockResolvedValue({
      summary: { tradeCount: 2 },
      trades: [],
      timeseries: { dates: [], portfolio: [], cash: [], drawdownPct: [], allocation: [] },
      annualTax: [],
    });

    await backtestAction({ file, start: "2025-01-01", end: "2025-12-31" });

    expect(process.exitCode).toBe(0);
    expect(stderr).toBe("");
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.result.backtest.summary.tradeCount).toBe(2);
  });

  it("maps condition parse failures to exit code 4", async () => {
    const file = await writeDraftFile(baseDraft);

    await addAllocationAction({
      file,
      name: "bad_alloc",
      condition: "spy_above_200d AND",
      holding: ["SPY:100"],
    });

    expect(process.exitCode).toBe(4);
    expect(stderr).toBe("");
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("condition_parse_error");
  });

  it("maps validation failures to exit code 2", async () => {
    const file = await writeDraftFile(baseDraft);

    await setTradingAction({
      file,
      frequency: "EveryMinute",
      offset: "0",
    });

    expect(process.exitCode).toBe(2);
    expect(stderr).toBe("");
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("invalid_frequency");
  });
});

