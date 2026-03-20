import { readFile } from 'node:fs/promises';
import { runDraftBacktest, type StrategyDraft } from '@livefolio/sdk/strategy-builder';
import { getLivefolio } from '../../config.js';

async function readDraft(filePath: string): Promise<StrategyDraft> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as StrategyDraft;
}

function parseRequiredDate(value: string | undefined, flagName: string): string {
  if (!value) {
    throw new Error(`${flagName} is required.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${flagName} must be in YYYY-MM-DD format.`);
  }
  return value;
}

function parseInitialCapital(value: string | undefined): number | undefined {
  if (value == null) {
    return undefined;
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('--initial-capital must be a positive number.');
  }
  return amount;
}

export async function backtestDraftAction(
  filePath: string,
  options: { start?: string; end?: string; initialCapital?: string },
): Promise<void> {
  try {
    const startDate = parseRequiredDate(options.start, '--start');
    const endDate = parseRequiredDate(options.end, '--end');
    const initialCapital = parseInitialCapital(options.initialCapital);
    const draft = await readDraft(filePath);
    const result = await runDraftBacktest(getLivefolio().market, draft, { startDate, endDate, initialCapital });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
