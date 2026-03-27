import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  Comparison,
  Frequency,
  Strategy,
  StrategyAllocationDraft,
  StrategyDraft,
} from "@livefolio/sdk/strategy";
import {
  invalidArgs,
  notFound,
  parseOrCompileFailure,
} from "./contract.js";

export interface LocalStrategyDraft
  extends Omit<StrategyDraft, "linkId"> {
  linkId?: string;
}

const SIGNAL_NAME_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const DATE_ONLY_YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;
const FREQUENCIES: Frequency[] = [
  "Daily",
  "Weekly",
  "Monthly",
  "Bi-monthly",
  "Quarterly",
  "Every 4 Months",
  "Semiannually",
  "Yearly",
];
const COMPARISONS: Comparison[] = [">", "<", "="];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function ensureSignalNameIdentifier(
  value: unknown,
  index: number,
): string {
  if (typeof value !== "string" || !SIGNAL_NAME_IDENTIFIER.test(value)) {
    throw invalidArgs(
      "invalid_signal_name",
      "Signal names must match [A-Za-z_][A-Za-z0-9_-]*.",
      { index, value },
    );
  }
  return value;
}

function ensureDate(value: string, field: string): string {
  if (!DATE_ONLY_YYYY_MM_DD.test(value)) {
    throw invalidArgs("invalid_date", `${field} must be YYYY-MM-DD.`, {
      field,
      value,
    });
  }
  return value;
}

function validateConditionNames(condition: unknown): void {
  if (!isObject(condition) || typeof condition.kind !== "string") {
    throw invalidArgs(
      "invalid_condition_shape",
      "Condition must be an object with a valid kind.",
    );
  }

  if (condition.kind === "signal" || condition.kind === "not") {
    ensureSignalNameIdentifier(condition.signalName, 0);
    return;
  }

  if (condition.kind === "and" || condition.kind === "or") {
    if (!Array.isArray(condition.args)) {
      throw invalidArgs(
        "invalid_condition_shape",
        'Condition kind "and" or "or" must include an args array.',
      );
    }
    for (const arg of condition.args) {
      validateConditionNames(arg);
    }
    return;
  }

  throw invalidArgs("invalid_condition_shape", `Unknown condition kind "${condition.kind}".`);
}

function validateLocalDraftShape(
  input: unknown,
  filePath: string,
): LocalStrategyDraft {
  if (!isObject(input)) {
    throw invalidArgs("invalid_strategy_file", "Strategy file must be a JSON object.", {
      file: filePath,
    });
  }

  const { linkId, name, trading, signals, allocations } = input;

  if (linkId !== undefined && typeof linkId !== "string") {
    throw invalidArgs("invalid_strategy_file", "linkId must be a string when provided.", {
      file: filePath,
    });
  }
  if (typeof name !== "string" || !name.trim()) {
    throw invalidArgs("invalid_strategy_file", "name is required and must be a non-empty string.", {
      file: filePath,
    });
  }
  if (!isObject(trading)) {
    throw invalidArgs("invalid_strategy_file", "trading is required and must be an object.", {
      file: filePath,
    });
  }
  if (!FREQUENCIES.includes(trading.frequency as Frequency)) {
    throw invalidArgs("invalid_strategy_file", "trading.frequency is invalid.", {
      file: filePath,
      value: trading.frequency,
    });
  }
  if (!Number.isInteger(trading.offset) || (trading.offset as number) < 0) {
    throw invalidArgs("invalid_strategy_file", "trading.offset must be an integer >= 0.", {
      file: filePath,
      value: trading.offset,
    });
  }
  if (!Array.isArray(signals)) {
    throw invalidArgs("invalid_strategy_file", "signals must be an array.", {
      file: filePath,
    });
  }
  if (!Array.isArray(allocations)) {
    throw invalidArgs("invalid_strategy_file", "allocations must be an array.", {
      file: filePath,
    });
  }

  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    if (!isObject(signal)) {
      throw invalidArgs("invalid_strategy_file", "signals entries must be objects.", {
        file: filePath,
        index: i,
      });
    }
    ensureSignalNameIdentifier(signal.name, i);
    if (!isObject(signal.signal)) {
      throw invalidArgs("invalid_strategy_file", "signal.signal must be an object.", {
        file: filePath,
        index: i,
      });
    }
    const comparison = signal.signal.comparison;
    if (!COMPARISONS.includes(comparison as Comparison)) {
      throw invalidArgs("invalid_strategy_file", "signal.signal.comparison is invalid.", {
        file: filePath,
        index: i,
        value: comparison,
      });
    }
    const tolerance = signal.signal.tolerance;
    if (!isFiniteNumber(tolerance)) {
      throw invalidArgs("invalid_strategy_file", "signal.signal.tolerance must be finite.", {
        file: filePath,
        index: i,
      });
    }
  }

  for (let i = 0; i < allocations.length; i++) {
    const allocation = allocations[i];
    if (!isObject(allocation)) {
      throw invalidArgs("invalid_strategy_file", "allocations entries must be objects.", {
        file: filePath,
        index: i,
      });
    }
    if (typeof allocation.name !== "string" || !allocation.name.trim()) {
      throw invalidArgs("invalid_strategy_file", "allocation name must be a non-empty string.", {
        file: filePath,
        index: i,
      });
    }
    validateConditionNames(allocation.condition);
    if (!Array.isArray(allocation.holdings)) {
      throw invalidArgs("invalid_strategy_file", "allocation holdings must be an array.", {
        file: filePath,
        index: i,
      });
    }
  }

  return input as unknown as LocalStrategyDraft;
}

export function parseLocalStrategyDraft(
  input: unknown,
  sourceLabel = "<input>",
): LocalStrategyDraft {
  return validateLocalDraftShape(input, sourceLabel);
}

function normalizeLinkId(source: LocalStrategyDraft): string {
  if (source.linkId && source.linkId.trim()) {
    return source.linkId.trim();
  }
  const slug = source.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `local-${slug || "strategy"}`;
}

export function asStrategyDraft(source: LocalStrategyDraft): StrategyDraft {
  return {
    linkId: normalizeLinkId(source),
    name: source.name,
    trading: source.trading,
    signals: source.signals,
    allocations: source.allocations,
  };
}

export function canonicalizeLocalStrategyDraft(
  source: LocalStrategyDraft,
): LocalStrategyDraft {
  const out: LocalStrategyDraft = {
    name: source.name,
    trading: source.trading,
    signals: source.signals,
    allocations: source.allocations,
  };
  if (source.linkId) {
    out.linkId = source.linkId;
    return {
      linkId: out.linkId,
      name: out.name,
      trading: out.trading,
      signals: out.signals,
      allocations: out.allocations,
    };
  }
  return out;
}

export async function readLocalStrategyDraft(filePath: string): Promise<LocalStrategyDraft> {
  const resolved = resolve(filePath);
  let content: string;
  try {
    content = await readFile(resolved, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw notFound("file_not_found", "Strategy file not found.", { file: resolved });
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw parseOrCompileFailure("invalid_json", "Strategy file is not valid JSON.", {
      file: resolved,
      cause: err instanceof Error ? err.message : String(err),
    });
  }
  return validateLocalDraftShape(parsed, resolved);
}

export function parseAtDate(value: string | undefined): Date {
  const at = value ? new Date(value) : new Date();
  if (!Number.isFinite(at.getTime())) {
    throw invalidArgs("invalid_date", "Invalid date value for --at.", { at: value });
  }
  return at;
}

export function parseYmd(value: string, field: string): string {
  return ensureDate(value, field);
}

export function ensureSignalExists(
  draft: LocalStrategyDraft,
  name: string,
): void {
  if (!draft.signals.some((signal) => signal.name === name)) {
    throw notFound("signal_not_found", "Signal was not found.", { name });
  }
}

export function ensureAllocationExists(
  draft: LocalStrategyDraft,
  name: string,
): void {
  if (!draft.allocations.some((allocation) => allocation.name === name)) {
    throw notFound("allocation_not_found", "Allocation was not found.", { name });
  }
}

export function ensureNoSignalReferences(
  draft: LocalStrategyDraft,
  signalName: string,
): void {
  const refs: string[] = [];
  const visit = (condition: StrategyAllocationDraft["condition"]): void => {
    if (condition.kind === "signal" || condition.kind === "not") {
      if (condition.signalName === signalName) refs.push(condition.signalName);
      return;
    }
    for (const arg of condition.args) visit(arg);
  };
  for (const allocation of draft.allocations) {
    visit(allocation.condition);
  }
  if (refs.length > 0) {
    throw invalidArgs(
      "signal_in_use",
      "Signal is still referenced by allocation conditions.",
      { name: signalName },
    );
  }
}

export async function writeLocalStrategyDraftAtomic(
  filePath: string,
  draft: LocalStrategyDraft,
): Promise<void> {
  const resolved = resolve(filePath);
  const dir = dirname(resolved);
  const tempPath = resolve(
    dir,
    `.${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2)}.tmp`,
  );
  const serialized = `${JSON.stringify(canonicalizeLocalStrategyDraft(draft), null, 2)}\n`;
  try {
    await writeFile(tempPath, serialized, "utf8");
    await rename(tempPath, resolved);
  } catch (err) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw err;
  }
}

export function formatCompileFailure(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  throw parseOrCompileFailure(
    "compile_failed",
    "Strategy compile failed.",
    { cause: message },
  );
}

export function formatCompiledResult(strategy: Strategy): { strategy: Strategy } {
  return { strategy };
}
