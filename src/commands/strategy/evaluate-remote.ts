import { getLivefolio } from "../../config.js";
import {
  notFound,
  runStrategyAction,
} from "./contract.js";
import { parseAtDate } from "./local-file.js";

export async function evaluateRemoteAction(
  linkId: string,
  options: { at?: string },
): Promise<void> {
  await runStrategyAction(async () => {
    const at = parseAtDate(options.at);
    const strategy = await getLivefolio().strategy.get(linkId);
    if (!strategy) {
      throw notFound("strategy_not_found", "Strategy not found.", { linkId });
    }

    const evaluation = await getLivefolio().strategy.evaluate(strategy, at);
    return {
      linkId,
      evaluation,
    };
  });
}

