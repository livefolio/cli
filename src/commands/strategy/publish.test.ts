import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publishAction } from "./publish.js";

const { mockApiRequest } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
}));

vi.mock("../../auth/api.js", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
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
    mockApiRequest.mockResolvedValue({
      linkId: "lf-testpublish",
      strategyId: 99,
      created: true,
    });

    await publishAction({
      file: strategyFile,
      backtestFile,
      baseUrl: "http://localhost:3000",
      writeLinkId: true,
    });

    expect(process.exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
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
    mockApiRequest
      .mockResolvedValueOnce(backtestResult)
      .mockResolvedValueOnce({
        linkId: "lf-inline",
        strategyId: 42,
        created: true,
      });

    await publishAction({
      file: strategyFile,
      start: "2020-01-01",
      end: "2020-12-31",
      baseUrl: "http://localhost:3000",
      writeLinkId: false,
    });

    expect(process.exitCode).toBe(0);
    expect(mockApiRequest).toHaveBeenNthCalledWith(
      1,
      "/api/strategy/backtest",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          startDate: "2020-01-01",
          endDate: "2020-12-31",
        }),
      }),
    );
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.result.backtestSummary.finalValue).toBe(120000);
    expect(parsed.result.linkId).toBe("lf-inline");
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
    expect(mockApiRequest).not.toHaveBeenCalled();
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("invalid_publish_options");
  });

  it("returns exit code 10 when publish response is malformed", async () => {
    const { strategyFile, backtestFile } = await writeFixtureFiles();
    mockApiRequest.mockResolvedValue({});

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
  });
});
