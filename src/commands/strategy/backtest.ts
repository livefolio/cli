import { getLivefolio } from "../../config.js";
import { runStrategyAction } from "./contract.js";
import { compileLocalDraftOrThrow } from "./compile-local.js";
import {
  parseYmd,
  readLocalStrategyDraft,
} from "./local-file.js";

export async function backtestAction(options: {
  file: string;
  start: string;
  end: string;
}): Promise<void> {
  await runStrategyAction(async () => {
    const draft = await readLocalStrategyDraft(options.file);
    const strategy = compileLocalDraftOrThrow(draft);
    const startDate = parseYmd(options.start, "start");
    const endDate = parseYmd(options.end, "end");
    const backtest = await getLivefolio().strategy.backtest(strategy, {
      startDate,
      endDate,
    });
    return {
      file: options.file,
      backtest,
    };
  });
}

