import {
  resolveType,
  parseTicker,
  TICKER_LOOKBACK_TYPES,
  TICKER_ONLY_TYPES,
  STANDALONE_TYPES,
} from "../commands/indicator.js";
import type { LivefolioClient } from "@livefolio/sdk";

// --- Threshold handling ---

const THRESHOLD_TYPE = "Threshold";

function isThresholdType(input: string): boolean {
  return input.toLowerCase() === "threshold";
}

// --- Exported types ---

export interface IndicatorSpec {
  type: string;
  ticker?: string;
  leverage?: number;
  lookback?: number;
  value?: number;
  delay?: number;
}

type Comparison = ">" | "<" | "=";

export interface SignalSpec {
  indicator1: IndicatorSpec;
  indicator2: IndicatorSpec;
  comparison: Comparison;
  tolerance: number;
}

// --- Indicator spec parsing ---

export function parseIndicatorSpec(input: string): IndicatorSpec {
  const parts = input.trim().split(/\s+/);

  // Strip trailing @<int> delay token (not applicable to thresholds, but we
  // parse it first so the rest of the logic sees a clean token list).
  let delay: number | undefined;
  const lastToken = parts[parts.length - 1];
  if (lastToken.startsWith("@")) {
    const raw = lastToken.slice(1);
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || raw === "") {
      throw new Error(
        `Delay must be an integer (e.g. @5 or @-3), got "${lastToken}"`,
      );
    }
    delay = parsed;
    parts.pop();
  }

  const rawType = parts[0];

  if (isThresholdType(rawType)) {
    if (parts.length < 2) {
      throw new Error("Threshold requires a <value>");
    }
    const v = Number(parts[1]);
    if (isNaN(v)) {
      throw new Error(`Threshold value must be a number, got "${parts[1]}"`);
    }
    return { type: THRESHOLD_TYPE, value: v };
  }

  const type = resolveType(rawType);
  if (!type) {
    const allTypes = [
      ...TICKER_LOOKBACK_TYPES,
      ...TICKER_ONLY_TYPES,
      ...STANDALONE_TYPES,
    ].map((t) => t.toLowerCase());
    throw new Error(
      `Unknown indicator type "${rawType}". Available: ${allTypes.join(", ")}`,
    );
  }

  const tlSet = new Set<string>(TICKER_LOOKBACK_TYPES);
  const toSet = new Set<string>(TICKER_ONLY_TYPES);

  if (tlSet.has(type)) {
    if (parts.length < 2) {
      throw new Error(`${type.toLowerCase()} requires <ticker> and <lookback>`);
    }
    if (parts.length < 3) {
      throw new Error(`${type.toLowerCase()} requires <ticker> and <lookback>`);
    }
    const parsed = parseTicker(parts[1]);
    const lb = Number(parts[2]);
    if (!Number.isInteger(lb) || lb <= 0) {
      throw new Error("Lookback must be a positive integer");
    }
    return {
      type,
      ticker: parsed.symbol,
      leverage: parsed.leverage,
      lookback: lb,
      ...(delay !== undefined && { delay }),
    };
  }

  if (toSet.has(type)) {
    if (parts.length < 2) {
      throw new Error(`${type.toLowerCase()} requires <ticker>`);
    }
    const parsed = parseTicker(parts[1]);
    return {
      type,
      ticker: parsed.symbol,
      leverage: parsed.leverage,
      ...(delay !== undefined && { delay }),
    };
  }

  return { type, ...(delay !== undefined && { delay }) };
}

// --- Signal string parsing ---

const OPERATOR_RE = / ([><=]) /;

export function parseSignalSpec(input: string): SignalSpec {
  // Strip trailing ~<number> tolerance suffix before any other parsing.
  let tolerance = 0;
  const toleranceMatch = input.match(/ ~(\S+)$/);
  if (toleranceMatch) {
    const raw = toleranceMatch[1];
    const parsed = Number(raw);
    if (isNaN(parsed)) {
      throw new Error(`Tolerance must be a number (e.g. ~0.5), got "~${raw}"`);
    }
    if (parsed < 0) {
      throw new Error(`Tolerance must be non-negative, got "~${raw}"`);
    }
    tolerance = parsed;
    input = input.slice(0, input.length - toleranceMatch[0].length);
  }

  const match = input.match(OPERATOR_RE);
  if (!match || match.index === undefined) {
    throw new Error(
      `Invalid signal spec "${input}". Expected format: "<indicator> > <indicator>"`,
    );
  }

  const comparison = match[1] as Comparison;
  const ind1Str = input.slice(0, match.index).trim();
  const ind2Str = input.slice(match.index + match[0].length).trim();

  if (!ind1Str) {
    throw new Error("Missing indicator before operator");
  }
  if (!ind2Str) {
    throw new Error("Missing indicator after operator");
  }

  return {
    indicator1: parseIndicatorSpec(ind1Str),
    indicator2: parseIndicatorSpec(ind2Str),
    comparison,
    tolerance,
  };
}

// --- Handle building ---

const TREASURY_TYPES = new Set([
  "T3M",
  "T6M",
  "T1Y",
  "T2Y",
  "T3Y",
  "T5Y",
  "T7Y",
  "T10Y",
  "T20Y",
  "T30Y",
]);

export function needsFredKey(spec: IndicatorSpec): boolean {
  return TREASURY_TYPES.has(spec.type);
}

export function buildIndicatorHandle(
  client: LivefolioClient,
  spec: IndicatorSpec,
) {
  const tlSet = new Set<string>(TICKER_LOOKBACK_TYPES);
  const toSet = new Set<string>(TICKER_ONLY_TYPES);

  const delayOpt = spec.delay !== undefined ? { delay: spec.delay } : undefined;

  if (spec.type === THRESHOLD_TYPE) {
    return client.threshold(spec.value!);
  }

  if (tlSet.has(spec.type)) {
    const t = client.ticker(spec.ticker!, spec.leverage);
    const lb = spec.lookback!;
    if (spec.type === "Return") {
      return client.returns(t, lb, delayOpt);
    }
    const method = spec.type.toLowerCase() as
      | "sma"
      | "ema"
      | "rsi"
      | "volatility"
      | "drawdown";
    return client[method](t, lb, delayOpt);
  }

  if (toSet.has(spec.type)) {
    return client.price(client.ticker(spec.ticker!, spec.leverage), delayOpt);
  }

  if (spec.type === "VIX") return client.vix(delayOpt);
  if (spec.type === "VIX3M") return client.vix3m(delayOpt);

  return client.treasury(
    spec.type as Parameters<typeof client.treasury>[0],
    delayOpt,
  );
}

export function buildSignalHandle(
  client: LivefolioClient,
  spec: SignalSpec,
  tolerance: number = 0,
) {
  const handle1 = buildIndicatorHandle(client, spec.indicator1);
  const handle2 = buildIndicatorHandle(client, spec.indicator2);

  if (spec.comparison === ">") {
    return client.gt(handle1, handle2, tolerance);
  } else if (spec.comparison === "<") {
    return client.lt(handle1, handle2, tolerance);
  } else {
    return client.eq(handle1, handle2, tolerance);
  }
}
