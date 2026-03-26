import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publishAction } from "./publish.js";

const { mockRpc, mockBacktest, mockCreateClient } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockBacktest: vi.fn(),
  mockCreateClient: vi.fn(() => ({ rpc: mockRpc })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

vi.mock("../../config.js", () => ({
  getLivefolio: () => ({
    strategy: { backtest: mockBacktest },
  }),
}));

const strategyDraft = {
  name: "Publish Test",
  trading: { frequency: "Weekly", offset: 0 },
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
      name: "Default",
      condition: { kind: "not", signalName: "spy_above_200d" },
      holdings: [{ ticker: { symbol: "BIL", leverage: 1 }, weight: 100 }],
    },
  ],
};

const backtestResult = {
  summary: {
    initialValue: 100000,
    finalValue: 120000,
    totalReturnPct: 20,
    cagrPct: 5,
    maxDrawdownPct: -10,
    annualizedVolatilityPct: 15,
    sharpeRatio: 0.6,
    tradeCount: 3,
  },
  timeseries: {
    dates: ["2024-01-02"],
    portfolio: [100000],
    cash: [0],
    drawdownPct: [0],
    allocation: ["Default"],
  },
  trades: [],
  annualTax: [],
};

let stdout = "";
let stderr = "";
let originalExitCode: number | undefined;
let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  stdout = "";
  stderr = "";
  originalExitCode = process.exitCode;
  process.exitCode = undefined;
  originalEnv = { ...process.env };
  process.env.SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  mockRpc.mockReset();
  mockBacktest.mockReset();
  mockCreateClient.mockClear();

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
  process.env = originalEnv;
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

async function writeFixtureFiles(): Promise<{ strategyFile: string; backtestFile: string }> {
  const dir = await mkdtemp(join(tmpdir(), "livefolio-publish-"));
  const strategyFile = join(dir, "strategy.json");
  const backtestFile = join(dir, "backtest.json");

  await writeFile(strategyFile, JSON.stringify(strategyDraft), "utf8");
  await writeFile(
    backtestFile,
    JSON.stringify({
      ok: true,
      result: {
        backtest: backtestResult,
      },
      warnings: [],
    }),
    "utf8",
  );

  return { strategyFile, backtestFile };
}

describe("publishAction", () => {
  it("publishes from backtest file and writes linkId into draft file", async () => {
    const { strategyFile, backtestFile } = await writeFixtureFiles();
    mockRpc.mockResolvedValue({
      data: { id: 99, linkId: "lf-testpublish", created: true },
      error: null,
    });

    await publishAction({
      file: strategyFile,
      backtestFile,
      baseUrl: "http://localhost:3000",
      writeLinkId: true,
    });

    expect(process.exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(mockCreateClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "anon-key");
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.result.linkId).toBe("lf-testpublish");
    expect(parsed.result.strategyId).toBe(99);
    expect(parsed.result.url).toBe("http://localhost:3000/strategies/lf-testpublish");

    const fileAfter = JSON.parse(await readFile(strategyFile, "utf8"));
    expect(fileAfter.linkId).toBe("lf-testpublish");
  });

  it("runs inline backtest when start/end are provided", async () => {
    const { strategyFile } = await writeFixtureFiles();
    mockBacktest.mockResolvedValue(backtestResult);
    mockRpc.mockResolvedValue({
      data: { id: 42, created: true },
      error: null,
    });

    await publishAction({
      file: strategyFile,
      start: "2020-01-01",
      end: "2020-12-31",
      baseUrl: "http://localhost:3000",
      writeLinkId: false,
    });

    expect(process.exitCode).toBe(0);
    expect(mockBacktest).toHaveBeenCalledTimes(1);
    expect(mockBacktest).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Publish Test" }),
      expect.objectContaining({ startDate: "2020-01-01", endDate: "2020-12-31" }),
    );
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.result.backtestSummary.finalValue).toBe(120000);
    expect(parsed.result.linkId).toMatch(/^lf-/);
  });

  it("returns exit code 2 when publish options are invalid", async () => {
    const { strategyFile, backtestFile } = await writeFixtureFiles();

    await publishAction({
      file: strategyFile,
      start: "2020-01-01",
      end: "2020-12-31",
      backtestFile,
      baseUrl: "http://localhost:3000",
      writeLinkId: true,
    });

    expect(process.exitCode).toBe(2);
    expect(mockRpc).not.toHaveBeenCalled();
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("invalid_publish_options");
  });

  it("returns exit code 10 when RPC publish fails", async () => {
    const { strategyFile, backtestFile } = await writeFixtureFiles();
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "db fail", code: "22000" },
    });

    await publishAction({
      file: strategyFile,
      backtestFile,
      baseUrl: "http://localhost:3000",
      writeLinkId: false,
    });

    expect(process.exitCode).toBe(10);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("publish_failed");
    expect(parsed.error.data.code).toBe("22000");
  });
});

