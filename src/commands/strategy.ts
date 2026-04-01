import { parseSignalSpec, type SignalSpec } from "../lib/parse.js";

// --- Types ---

interface ParsedRule {
  signals: SignalSpec[];
  hold: Record<string, number>;
}

interface ParsedStrategy {
  name: string;
  freq: string;
  offset: number;
  rules: ParsedRule[];
}

const VALID_FREQS = new Set([
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Yearly",
]);

// --- JSON parsing ---

export function parseStrategyJson(input: string): ParsedStrategy {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new Error("Invalid JSON: could not parse input");
  }

  const obj = raw as Record<string, unknown>;

  if (!obj.name || typeof obj.name !== "string") {
    throw new Error("name is required and must be a string");
  }

  const freq = (obj.freq as string) ?? "Daily";
  if (!VALID_FREQS.has(freq)) {
    throw new Error(
      `Invalid freq "${freq}". Must be one of: ${[...VALID_FREQS].join(", ")}`,
    );
  }

  const offset = (obj.offset as number) ?? 0;

  if (!Array.isArray(obj.rules)) {
    throw new Error("rules is required and must be an array");
  }
  if (obj.rules.length === 0) {
    throw new Error("rules must contain at least one rule");
  }

  const rules: ParsedRule[] = [];

  for (let i = 0; i < obj.rules.length; i++) {
    const rule = obj.rules[i] as Record<string, unknown>;
    const isLast = i === obj.rules.length - 1;
    const hasWhen = rule.when !== undefined;

    if (!rule.hold || typeof rule.hold !== "object") {
      throw new Error(`Rule ${i + 1}: hold is required`);
    }

    if (isLast && hasWhen) {
      throw new Error("Last rule must be a fallback (no when clause)");
    }
    if (!isLast && !hasWhen) {
      throw new Error(`Non-fallback rule ${i + 1} must have a when clause`);
    }

    const signals: SignalSpec[] = [];
    if (hasWhen) {
      const whenArr = rule.when as string[];
      for (const spec of whenArr) {
        signals.push(parseSignalSpec(spec));
      }
    }

    rules.push({
      signals,
      hold: rule.hold as Record<string, number>,
    });
  }

  return { name: obj.name, freq, offset, rules };
}
