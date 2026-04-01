import { buildRebalancePlan } from "@livefolio/sdk/portfolio";

interface RebalanceOptions {
  targets: string;
  current: string;
  prices: string;
  cash: string;
  total: string;
  threshold?: string;
  cashSymbol?: string;
}

function parsePairs(input: string, name: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const pair of input.split(",")) {
    const parts = pair.split(":");
    if (parts.length !== 2 || !parts[0]?.trim() || !parts[1]?.trim()) {
      throw new Error(`invalid ${name} pair: "${pair}" (expected SYMBOL:NUMBER)`);
    }
    const trimmedValue = parts[1].trim();
    const value = Number(trimmedValue);
    if (!isFinite(value)) {
      throw new Error(`invalid ${name} value for ${parts[0].trim()}: "${trimmedValue}" is not a number`);
    }
    const symbol = parts[0].trim().toUpperCase();
    if (symbol in result) {
      throw new Error(`duplicate ${name} symbol: "${symbol}"`);
    }
    result[symbol] = value;
  }
  return result;
}

function parseNumber(input: string, name: string): number {
  const trimmed = input.trim();
  const value = Number(trimmed);
  if (!isFinite(value)) {
    throw new Error(`invalid ${name}: "${trimmed}" is not a number`);
  }
  return value;
}

export async function rebalanceAction(options: RebalanceOptions): Promise<void> {
  try {
    const targetWeights = parsePairs(options.targets, "targets");
    const currentValues = parsePairs(options.current, "current");
    const prices = parsePairs(options.prices, "prices");
    const cashValue = parseNumber(options.cash, "cash");
    const totalValue = parseNumber(options.total, "total");

    const plan = buildRebalancePlan({
      targetWeights,
      currentValues,
      prices,
      cashValue,
      totalValue,
      ...(options.threshold != null && {
        portfolioDriftThresholdPercentPoints: parseNumber(options.threshold, "threshold"),
      }),
      ...(options.cashSymbol != null && { cashSymbol: options.cashSymbol.toUpperCase() }),
    });

    console.log(JSON.stringify(plan, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
