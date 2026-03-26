import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  canonicalizeLivefolioDefinition,
  deriveLivefolioLinkId,
  hashLivefolioDefinition,
  type BacktestResult,
  type SignalNameCondition,
} from "@livefolio/sdk/strategy";
import { getLivefolio } from "../../config.js";
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

interface PublishRpcResult {
  id?: number;
  linkId?: string;
  created?: boolean;
}

function toDbCondition(condition: SignalNameCondition): unknown {
  switch (condition.kind) {
    case "signal":
      return {
        kind: "signal",
        arg: { name: condition.signalName },
      };
    case "not":
      return {
        kind: "not",
        arg: {
          kind: "signal",
          arg: { name: condition.signalName },
        },
      };
    case "and":
    case "or":
      return {
        kind: condition.kind,
        args: condition.args.map((entry) => toDbCondition(entry)),
      };
  }
}

function toDbStrategyShape(
  draft: Awaited<ReturnType<typeof readLocalStrategyDraft>>,
  linkId: string,
  definition: unknown,
  backtest: BacktestResult | undefined,
): unknown {
  return {
    linkId,
    name: draft.name.trim() || linkId,
    trading: draft.trading,
    signals: draft.signals.map((signal) => ({
      name: signal.name,
      ...signal.signal,
    })),
    allocations: draft.allocations.map((allocation) => ({
      name: allocation.name,
      condition: toDbCondition(allocation.condition),
      holdings: allocation.holdings,
    })),
    definition,
    backtest: backtest
      ? {
          source: "livefolio",
          version: 1,
          summary: backtest.summary,
          timeseries: backtest.timeseries,
          annualTax: backtest.annualTax,
        }
      : null,
  };
}

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

function resolveSupabaseConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw invalidArgs(
      "missing_supabase_env",
      "SUPABASE_URL and one of SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY are required.",
    );
  }
  return { url, key };
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
    const compiled = compileLocalDraftOrThrow(draft);

    let backtest: BacktestResult | undefined;
    if (options.backtestFile) {
      backtest = await loadBacktestFromFile(options.backtestFile);
    } else if (options.start && options.end) {
      const startDate = parseYmd(options.start, "start");
      const endDate = parseYmd(options.end, "end");
      backtest = await getLivefolio().strategy.backtest(compiled, {
        startDate,
        endDate,
      });
    }

    const definitionInput: any = {
      source: "livefolio",
      version: 1,
      draft,
    };
    const definition = canonicalizeLivefolioDefinition(definitionInput);
    const definitionHash = hashLivefolioDefinition(definition as any);
    const derivedLinkId = deriveLivefolioLinkId(definitionHash);
    const linkId = draft.linkId?.trim() || derivedLinkId;
    const strategyForDb = toDbStrategyShape(draft, linkId, definition, backtest);

    const { url, key } = resolveSupabaseConfig();
    const supabase = createClient(url, key);
    const { data, error } = await supabase.rpc("upsert_livefolio_strategy", {
      strategy: strategyForDb,
      p_definition_hash: definitionHash,
      p_link_id: linkId,
    });

    if (error) {
      throw internalError("publish_failed", "Failed to persist strategy.", {
        cause: error.message,
        code: error.code,
      });
    }

    const rpc = ((data ?? {}) as PublishRpcResult);
    const persistedLinkId = rpc.linkId ?? linkId;

    if (options.writeLinkId && draft.linkId !== persistedLinkId) {
      draft.linkId = persistedLinkId;
      await writeLocalStrategyDraftAtomic(options.file, draft);
    }

    return {
      file: options.file,
      linkId: persistedLinkId,
      definitionHash,
      strategyId: rpc.id ?? null,
      created: rpc.created ?? null,
      ...(backtest ? { backtestSummary: backtest.summary } : {}),
      url: buildStrategyUrl(options.baseUrl, persistedLinkId),
    };
  });
}
