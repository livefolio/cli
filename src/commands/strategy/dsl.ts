import type {
  BacktestRebalanceConfig,
  Indicator,
  IndicatorType,
  SignalNameAndExpr,
  SignalNameCondition,
  SignalNameUnaryExpr,
} from "@livefolio/sdk/strategy";
import {
  invalidArgs,
  parseOrCompileFailure,
} from "./contract.js";

const SIGNAL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const SYMBOL_IDENTIFIER = /^[A-Za-z][A-Za-z0-9._-]*$/;

const INDICATOR_TYPES = new Set<IndicatorType>([
  "SMA",
  "EMA",
  "Price",
  "Return",
  "Volatility",
  "Drawdown",
  "RSI",
  "VIX",
  "VIX3M",
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
  "Month",
  "Day of Week",
  "Day of Month",
  "Day of Year",
  "Threshold",
]);

const TEMPORAL_TYPES = new Set<IndicatorType>([
  "Month",
  "Day of Week",
  "Day of Month",
  "Day of Year",
]);

function indicatorUnit(type: IndicatorType): Indicator["unit"] {
  if (
    type === "Threshold" ||
    type === "Month" ||
    type === "Day of Week" ||
    type === "Day of Month" ||
    type === "Day of Year" ||
    type === "RSI"
  ) {
    return null;
  }
  if (
    type === "Return" ||
    type === "Volatility" ||
    type === "Drawdown" ||
    type.startsWith("T")
  ) {
    return "%";
  }
  return "$";
}

function parseFiniteNumber(
  value: string,
  field: string,
  original: string,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw invalidArgs("invalid_number", `${field} must be a finite number.`, {
      field,
      value: original,
    });
  }
  return parsed;
}

function parsePositiveInteger(
  value: string,
  field: string,
  original: string,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw invalidArgs("invalid_integer", `${field} must be an integer >= 0.`, {
      field,
      value: original,
    });
  }
  return parsed;
}

export function isValidSignalIdentifier(name: string): boolean {
  return SIGNAL_IDENTIFIER.test(name);
}

function parseTickerSpec(spec: string): { symbol: string; leverage: number } {
  const [rawSymbol, ...queryParts] = spec.trim().split("?");
  const symbol = rawSymbol.trim().toUpperCase();
  if (!SYMBOL_IDENTIFIER.test(symbol)) {
    throw invalidArgs("invalid_ticker", "Ticker symbol is invalid.", { ticker: spec });
  }

  let leverage = 1;
  if (queryParts.length) {
    const query = queryParts.join("?");
    const match = /^L=([-+]?\d+(?:\.\d+)?)$/i.exec(query.trim());
    if (!match) {
      throw invalidArgs("invalid_ticker", "Ticker leverage suffix must be ?L=<number>.", {
        ticker: spec,
      });
    }
    leverage = parseFiniteNumber(match[1], "leverage", spec);
    if (leverage <= 0) {
      throw invalidArgs("invalid_ticker", "Ticker leverage must be > 0.", {
        ticker: spec,
      });
    }
  }

  return { symbol, leverage };
}

function splitCsvArgs(source: string): string[] {
  return source
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseIndicatorDsl(input: string): Indicator {
  const trimmed = input.trim();
  const match = /^([A-Za-z][A-Za-z0-9 ]*)\((.*)\)$/.exec(trimmed);
  if (!match) {
    throw parseOrCompileFailure(
      "indicator_parse_error",
      "Indicator DSL is invalid. Expected Type(arg1,arg2...).",
      { input },
    );
  }

  const typeRaw = match[1].trim() as IndicatorType;
  if (!INDICATOR_TYPES.has(typeRaw)) {
    throw parseOrCompileFailure(
      "indicator_parse_error",
      `Unsupported indicator type "${typeRaw}".`,
      { input },
    );
  }

  const args = splitCsvArgs(match[2]);

  if (typeRaw === "Threshold") {
    if (args.length !== 1) {
      throw parseOrCompileFailure(
        "indicator_parse_error",
        "Threshold(...) requires one numeric argument.",
        { input },
      );
    }
    const threshold = parseFiniteNumber(args[0], "threshold", input);
    return {
      type: typeRaw,
      ticker: { symbol: "", leverage: 1 },
      lookback: 1,
      delay: 0,
      unit: indicatorUnit(typeRaw),
      threshold,
    };
  }

  if (TEMPORAL_TYPES.has(typeRaw)) {
    if (args.length !== 0) {
      throw parseOrCompileFailure(
        "indicator_parse_error",
        `${typeRaw}(...) does not accept arguments.`,
        { input },
      );
    }
    return {
      type: typeRaw,
      ticker: { symbol: "", leverage: 1 },
      lookback: 1,
      delay: 0,
      unit: indicatorUnit(typeRaw),
      threshold: null,
    };
  }

  if (args.length < 1 || args.length > 3) {
    throw parseOrCompileFailure(
      "indicator_parse_error",
      "Indicator DSL requires ticker and optional lookback/delay args.",
      { input },
    );
  }

  const ticker = parseTickerSpec(args[0]);
  const lookback = args[1]
    ? parsePositiveInteger(args[1], "lookback", input)
    : typeRaw === "Price"
      ? 1
      : Number.NaN;
  if (!Number.isFinite(lookback) || lookback < 1) {
    throw parseOrCompileFailure(
      "indicator_parse_error",
      `${typeRaw} requires a positive lookback.`,
      { input },
    );
  }
  const delay = args[2] ? parsePositiveInteger(args[2], "delay", input) : 0;

  return {
    type: typeRaw,
    ticker,
    lookback,
    delay,
    unit: indicatorUnit(typeRaw),
    threshold: null,
  };
}

export function parseHoldingDsl(input: string): {
  ticker: { symbol: string; leverage: number };
  weight: number;
} {
  const trimmed = input.trim();
  const sep = trimmed.lastIndexOf(":");
  if (sep <= 0 || sep === trimmed.length - 1) {
    throw parseOrCompileFailure(
      "holding_parse_error",
      'Holding DSL is invalid. Expected "TICKER:WEIGHT".',
      { input },
    );
  }
  const ticker = parseTickerSpec(trimmed.slice(0, sep));
  const weight = parseFiniteNumber(trimmed.slice(sep + 1), "weight", input);
  if (weight < 0 || weight > 100) {
    throw invalidArgs("invalid_holding_weight", "Holding weight must be between 0 and 100.", {
      input,
      weight,
    });
  }
  return { ticker, weight };
}

type ConditionTokenType =
  | "IDENT"
  | "AND"
  | "OR"
  | "NOT"
  | "LPAREN"
  | "RPAREN";

interface ConditionToken {
  type: ConditionTokenType;
  value: string;
  index: number;
}

interface LiteralNode {
  type: "literal";
  name: string;
  negated: boolean;
}

interface BinaryNode {
  type: "and" | "or";
  left: ExprNode;
  right: ExprNode;
}

type ExprNode = LiteralNode | BinaryNode;

interface ParserState {
  tokens: ConditionToken[];
  index: number;
}

type DnfLiteral = { name: string; negated: boolean };
type DnfClause = DnfLiteral[];

function isIdentChar(ch: string): boolean {
  return /[A-Za-z0-9_-]/.test(ch);
}

function tokenizeCondition(input: string): ConditionToken[] {
  const tokens: ConditionToken[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: ch, index: i });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ch, index: i });
      i++;
      continue;
    }

    const remaining = input.slice(i);
    const operatorMatch = /^(AND|OR|NOT)\b/.exec(remaining);
    if (operatorMatch) {
      const value = operatorMatch[1] as "AND" | "OR" | "NOT";
      tokens.push({ type: value, value, index: i });
      i += value.length;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < input.length && isIdentChar(input[j])) j++;
      const name = input.slice(i, j);
      if (!SIGNAL_IDENTIFIER.test(name)) {
        throw parseOrCompileFailure(
          "condition_parse_error",
          "Condition signal references must match [A-Za-z_][A-Za-z0-9_-]*.",
          { input, index: i, token: name },
        );
      }
      tokens.push({ type: "IDENT", value: name, index: i });
      i = j;
      continue;
    }

    throw parseOrCompileFailure(
      "condition_parse_error",
      "Condition contains an invalid token.",
      { input, index: i, token: ch },
    );
  }
  return tokens;
}

function peek(state: ParserState): ConditionToken | undefined {
  return state.tokens[state.index];
}

function consume(state: ParserState): ConditionToken | undefined {
  const token = state.tokens[state.index];
  if (token) state.index += 1;
  return token;
}

function expect(
  state: ParserState,
  type: ConditionTokenType,
  input: string,
): ConditionToken {
  const token = consume(state);
  if (!token || token.type !== type) {
    throw parseOrCompileFailure(
      "condition_parse_error",
      `Expected token ${type}.`,
      { input, at: token?.index ?? input.length },
    );
  }
  return token;
}

function parsePrimary(state: ParserState, input: string): ExprNode {
  const token = peek(state);
  if (!token) {
    throw parseOrCompileFailure(
      "condition_parse_error",
      "Unexpected end of expression.",
      { input },
    );
  }
  if (token.type === "IDENT") {
    consume(state);
    return { type: "literal", name: token.value, negated: false };
  }
  if (token.type === "NOT") {
    consume(state);
    const next = peek(state);
    if (!next || next.type !== "IDENT") {
      throw parseOrCompileFailure(
        "condition_parse_error",
        "NOT must be followed by a signal identifier.",
        { input, at: token.index },
      );
    }
    consume(state);
    return { type: "literal", name: next.value, negated: true };
  }
  if (token.type === "LPAREN") {
    consume(state);
    const nested = parseOr(state, input);
    expect(state, "RPAREN", input);
    return nested;
  }
  throw parseOrCompileFailure(
    "condition_parse_error",
    "Unexpected token in condition expression.",
    { input, at: token.index, token: token.value },
  );
}

function parseAnd(state: ParserState, input: string): ExprNode {
  let node = parsePrimary(state, input);
  while (peek(state)?.type === "AND") {
    consume(state);
    const right = parsePrimary(state, input);
    node = { type: "and", left: node, right };
  }
  return node;
}

function parseOr(state: ParserState, input: string): ExprNode {
  let node = parseAnd(state, input);
  while (peek(state)?.type === "OR") {
    consume(state);
    const right = parseAnd(state, input);
    node = { type: "or", left: node, right };
  }
  return node;
}

function toDnf(expr: ExprNode): DnfClause[] {
  if (expr.type === "literal") {
    return [[{ name: expr.name, negated: expr.negated }]];
  }
  if (expr.type === "or") {
    return [...toDnf(expr.left), ...toDnf(expr.right)];
  }
  const left = toDnf(expr.left);
  const right = toDnf(expr.right);
  const out: DnfClause[] = [];
  for (const l of left) {
    for (const r of right) {
      out.push([...l, ...r]);
      if (out.length > 128) {
        throw parseOrCompileFailure(
          "condition_parse_error",
          "Condition expression is too complex.",
        );
      }
    }
  }
  return out;
}

function normalizeClause(clause: DnfClause): DnfClause | null {
  const signByName = new Map<string, boolean>();
  for (const literal of clause) {
    const current = signByName.get(literal.name);
    if (current === undefined) {
      signByName.set(literal.name, literal.negated);
      continue;
    }
    if (current !== literal.negated) {
      return null;
    }
  }
  const entries = [...signByName.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, negated]) => ({ name, negated }));
  return entries;
}

function clauseToAndExpr(clause: DnfClause): SignalNameAndExpr {
  return {
    kind: "and",
    args: clause.map<SignalNameUnaryExpr>((literal) =>
      literal.negated
        ? { kind: "not", signalName: literal.name }
        : { kind: "signal", signalName: literal.name },
    ),
  };
}

export function parseConditionDsl(input: string): SignalNameCondition {
  const tokens = tokenizeCondition(input.trim());
  if (tokens.length === 0) {
    throw parseOrCompileFailure("condition_parse_error", "Condition expression cannot be empty.", {
      input,
    });
  }
  const state: ParserState = { tokens, index: 0 };
  const ast = parseOr(state, input);
  if (state.index !== tokens.length) {
    const token = tokens[state.index];
    throw parseOrCompileFailure(
      "condition_parse_error",
      "Unexpected trailing token in condition expression.",
      { input, token: token.value, at: token.index },
    );
  }

  const normalizedClauses = toDnf(ast)
    .map(normalizeClause)
    .filter((clause): clause is DnfClause => clause !== null);
  if (!normalizedClauses.length) {
    throw parseOrCompileFailure(
      "condition_parse_error",
      "Condition expression is unsatisfiable.",
      { input },
    );
  }

  if (normalizedClauses.length === 1 && normalizedClauses[0].length === 1) {
    const [literal] = normalizedClauses[0];
    return literal.negated
      ? { kind: "not", signalName: literal.name }
      : { kind: "signal", signalName: literal.name };
  }

  if (normalizedClauses.length === 1) {
    return clauseToAndExpr(normalizedClauses[0]);
  }

  return {
    kind: "or",
    args: normalizedClauses.map(clauseToAndExpr),
  };
}

export function collectDslList(value: string, previous: string[] = []): string[] {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return [...previous, ...parts];
}

export function parseRebalanceFromOptions(options: {
  rebalanceMode?: string;
  driftPct?: string;
  calendarFrequency?: string;
}): BacktestRebalanceConfig | undefined {
  if (!options.rebalanceMode) return undefined;

  if (options.rebalanceMode === "on_change") {
    return { mode: "on_change" };
  }
  if (options.rebalanceMode === "drift") {
    const driftPct = parseFiniteNumber(options.driftPct ?? "", "driftPct", String(options.driftPct));
    if (driftPct < 0 || driftPct > 100) {
      throw invalidArgs("invalid_drift_pct", "driftPct must be between 0 and 100.", { driftPct });
    }
    return { mode: "drift", driftPct };
  }
  if (options.rebalanceMode === "calendar") {
    if (
      options.calendarFrequency !== "Daily" &&
      options.calendarFrequency !== "Monthly" &&
      options.calendarFrequency !== "Yearly"
    ) {
      throw invalidArgs(
        "invalid_calendar_frequency",
        "calendarFrequency must be Daily, Monthly, or Yearly.",
        { calendarFrequency: options.calendarFrequency },
      );
    }
    return { mode: "calendar", frequency: options.calendarFrequency };
  }

  throw invalidArgs("invalid_rebalance_mode", "rebalanceMode is invalid.", {
    rebalanceMode: options.rebalanceMode,
  });
}

