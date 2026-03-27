import { apiRequest } from "../../auth/api.js";
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
    const query = new URLSearchParams({ at: at.toISOString() });
    const response = await apiRequest(`/api/strategy/${encodeURIComponent(linkId)}/evaluate?${query.toString()}`);
    const evaluation = response && typeof response === "object" && "evaluation" in response
      ? (response as { evaluation?: unknown }).evaluation
      : null;
    if (!evaluation) {
      throw notFound("strategy_not_found", "Strategy not found.", { linkId });
    }
    return {
      linkId,
      evaluation,
    };
  });
}
