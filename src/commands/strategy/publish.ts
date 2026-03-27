import { readFile } from "node:fs/promises";
import { type BacktestResult } from "@livefolio/sdk/strategy";
import { apiRequest } from "../../auth/api.js";
import { compileLocalDraftOrThrow } from "./compile-local.js";
import {
  invalidArgs,
  internalError,
  notFound,
  parseOrCompileFailure,
  runStrategyAction,
} from "./contract.js";
import {
  parseYmd,
  readLocalStrategyDraft,
  writeLocalStrategyDraftAtomic,
} from "./local-file.js";

function isBacktestResult(value: unknown): value is BacktestResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.summary === "object" &&
    candidate.summary !== null &&
    typeof candidate.timeseries === "object" &&
    candidate.timeseries !== null &&
    Array.isArray(candidate.trades) &&
    Array.isArray(candidate.annualTax)
  );
}

function extractBacktestFromUnknown(raw: unknown, sourceLabel: string): BacktestResult {
  if (isBacktestResult(raw)) return raw;
  if (typeof raw !== "object" || raw === null) {
    throw invalidArgs("invalid_backtest_file", "Backtest file JSON shape is invalid.", {
      file: sourceLabel,
    });
  }

  const asRecord = raw as Record<string, unknown>;
  const nested = asRecord.result;
  if (
    typeof nested === "object" &&
    nested !== null &&
    isBacktestResult((nested as Record<string, unknown>).backtest)
  ) {
    return (nested as Record<string, unknown>).backtest as BacktestResult;
  }

  throw invalidArgs("invalid_backtest_file", "Backtest file JSON shape is invalid.", {
    file: sourceLabel,
  });
}

async function loadBacktestFromFile(filePath: string): Promise<BacktestResult> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw notFound("file_not_found", "Backtest file not found.", { file: filePath });
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw parseOrCompileFailure("invalid_json", "Backtest file is not valid JSON.", {
      file: filePath,
      cause: err instanceof Error ? err.message : String(err),
    });
  }

  return extractBacktestFromUnknown(parsed, filePath);
}

function buildStrategyUrl(baseUrl: string, linkId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/strategies/${linkId}`;
}

export async function publishAction(options: {
  file: string;
  start?: string;
  end?: string;
  backtestFile?: string;
  baseUrl: string;
  writeLinkId: boolean;
}): Promise<void> {
  await runStrategyAction(async () => {
    const wantsInlineBacktest = Boolean(options.start || options.end);
    if (wantsInlineBacktest && (!options.start || !options.end)) {
      throw invalidArgs(
        "invalid_backtest_range",
        "Both --start and --end are required when running backtest in publish.",
      );
    }
    if (options.backtestFile && wantsInlineBacktest) {
      throw invalidArgs(
        "invalid_publish_options",
        "Use either --backtest-file or --start/--end, not both.",
      );
    }

    const draft = await readLocalStrategyDraft(options.file);
    compileLocalDraftOrThrow(draft);

    let backtest: BacktestResult | undefined;
    if (options.backtestFile) {
      backtest = await loadBacktestFromFile(options.backtestFile);
    } else if (options.start && options.end) {
      const startDate = parseYmd(options.start, "start");
      const endDate = parseYmd(options.end, "end");
      backtest = await apiRequest("/api/strategy/backtest", {
        method: "POST",
        body: {
          draft,
          startDate,
          endDate,
        },
        baseUrl: options.baseUrl,
      }) as BacktestResult;
    }

    const response = await apiRequest("/api/strategy/publish", {
      method: "POST",
      body: {
        draft,
        ...(backtest ? { backtest } : {}),
      },
      baseUrl: options.baseUrl,
    });

    const publishResult = (response ?? {}) as {
      linkId?: string;
      strategyId?: number | null;
      created?: boolean | null;
    };
    const persistedLinkId = publishResult.linkId;
    if (!persistedLinkId) {
      throw internalError("publish_failed", "Publish response did not include linkId.");
    }

    if (options.writeLinkId && draft.linkId !== persistedLinkId) {
      draft.linkId = persistedLinkId;
      await writeLocalStrategyDraftAtomic(options.file, draft);
    }

    return {
      file: options.file,
      linkId: persistedLinkId,
      strategyId: publishResult.strategyId ?? null,
      created: publishResult.created ?? null,
      ...(backtest ? { backtestSummary: backtest.summary } : {}),
      url: buildStrategyUrl(options.baseUrl, persistedLinkId),
    };
  });
}
