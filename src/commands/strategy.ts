import { Command } from "commander";
import { readEnv, buildClient } from "../lib/client.js";
import {
  parseSignalSpec,
  buildSignalHandle,
  needsFredKey,
  type SignalSpec,
} from "../lib/parse.js";
import { parseTicker } from "./indicator.js";
import type { LivefolioClient } from "@livefolio/sdk";

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

function buildStrategyHandles(client: LivefolioClient, parsed: ParsedStrategy) {
  const rules = parsed.rules.map((rule) => {
    const when = rule.signals.map((sig) => buildSignalHandle(client, sig));

    const holdPairs = Object.entries(rule.hold).map(([sym, weight]) => {
      const { symbol, leverage } = parseTicker(sym);
      return [client.ticker(symbol, leverage), weight] as [
        ReturnType<LivefolioClient["ticker"]>,
        number,
      ];
    });
    const hold = client.allocation(...holdPairs);

    return when.length > 0 ? { when, hold } : { hold };
  });

  return client.strategy({
    name: parsed.name,
    freq: parsed.freq as
      | "Daily"
      | "Weekly"
      | "Monthly"
      | "Quarterly"
      | "Yearly",
    offset: parsed.offset,
    rules,
  });
}

function makePostCommand(): Command {
  return new Command("post")
    .description("Create a strategy from JSON and print its link_id")
    .argument("<json>", "strategy definition as simplified JSON")
    .action(async (jsonArg: string) => {
      let parsed: ParsedStrategy;
      try {
        parsed = parseStrategyJson(jsonArg);
      } catch (e) {
        console.error(`Error: ${(e as Error).message}`);
        process.exit(1);
      }

      let env;
      try {
        env = readEnv();
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }

      // Check FRED key for treasury indicators in signals
      for (const rule of parsed.rules) {
        for (const sig of rule.signals) {
          if (needsFredKey(sig.indicator1) || needsFredKey(sig.indicator2)) {
            if (!env.fredApiKey) {
              console.error(
                "Error: FRED_API_KEY is required for treasury indicators",
              );
              process.exit(1);
            }
          }
        }
      }

      const client = buildClient(env);

      try {
        const strategy = buildStrategyHandles(client, parsed);
        const row = await strategy.resolve();
        console.log(row.link_id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : JSON.stringify(e);
        console.error(`Error: ${msg}`);
        process.exit(1);
      }
    });
}

export function makeStrategyCommand(): Command {
  const cmd = new Command("strategy").description(
    "Create, simulate, and inspect strategies",
  );
  cmd.addCommand(makePostCommand());
  return cmd;
}
