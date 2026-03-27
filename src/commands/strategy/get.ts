import { apiRequest } from "../../auth/api.js";
import {
  notFound,
  runStrategyAction,
} from "./contract.js";

export async function getAction(linkId: string): Promise<void> {
  await runStrategyAction(async () => {
    const response = await apiRequest(`/api/strategy/${encodeURIComponent(linkId)}`);
    const strategy = response && typeof response === "object" && "strategy" in response
      ? (response as { strategy?: unknown }).strategy
      : null;

    if (!strategy) {
      throw notFound("strategy_not_found", "Strategy not found.", { linkId });
    }

    return {
      linkId,
      strategy,
    };
  });
}
