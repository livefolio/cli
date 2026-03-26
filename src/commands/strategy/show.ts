import { runStrategyAction } from "./contract.js";
import {
  canonicalizeLocalStrategyDraft,
  readLocalStrategyDraft,
} from "./local-file.js";

export async function showAction(options: { file: string }): Promise<void> {
  await runStrategyAction(async () => {
    const draft = await readLocalStrategyDraft(options.file);
    return {
      file: options.file,
      strategy: canonicalizeLocalStrategyDraft(draft),
    };
  });
}

