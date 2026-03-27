import { getLivefolio } from "../../config.js";
import { runStrategyAction } from "./contract.js";
import { compileLocalDraftOrThrow } from "./compile-local.js";
import {
  parseAtDate,
  readLocalStrategyDraft,
} from "./local-file.js";

export async function evaluateAction(options: {
  file: string;
  at?: string;
}): Promise<void> {
  await runStrategyAction(async () => {
    const draft = await readLocalStrategyDraft(options.file);
    const strategy = compileLocalDraftOrThrow(draft);
    const at = parseAtDate(options.at);
    const evaluation = await getLivefolio().strategy.evaluate(strategy, at);
    return {
      file: options.file,
      evaluation,
    };
  });
}

