import { readFile } from 'node:fs/promises';
import { compileDraftStrategy, type StrategyDraft } from '@livefolio/sdk/strategy-builder';

async function readDraft(filePath: string): Promise<StrategyDraft> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as StrategyDraft;
}

export async function compileDraftAction(filePath: string): Promise<void> {
  try {
    const draft = await readDraft(filePath);
    const strategy = compileDraftStrategy(draft);
    console.log(JSON.stringify(strategy, null, 2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
