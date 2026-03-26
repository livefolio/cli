import {
  invalidArgs,
  runStrategyAction,
} from "./contract.js";
import {
  collectDslList,
  parseConditionDsl,
  parseHoldingDsl,
  parseRebalanceFromOptions,
} from "./dsl.js";
import {
  readLocalStrategyDraft,
  writeLocalStrategyDraftAtomic,
} from "./local-file.js";
import { validateDraftForMutationOrThrow } from "./compile-local.js";

export async function addAllocationAction(options: {
  file: string;
  name: string;
  condition: string;
  holding: string[];
  rebalanceMode?: string;
  driftPct?: string;
  calendarFrequency?: string;
}): Promise<void> {
  await runStrategyAction(async () => {
    const holdingsDsl = options.holding.flatMap((entry) => collectDslList(entry));
    if (!holdingsDsl.length) {
      throw invalidArgs("missing_holding", "At least one --holding is required.");
    }

    const draft = await readLocalStrategyDraft(options.file);
    if (draft.signals.length === 0) {
      throw invalidArgs(
        "no_signals_defined",
        "Add at least one signal before adding allocations.",
      );
    }
    if (draft.allocations.some((allocation) => allocation.name === options.name)) {
      throw invalidArgs("duplicate_allocation_name", "Allocation name already exists.", {
        name: options.name,
      });
    }

    const rebalance = parseRebalanceFromOptions(options);
    const allocation = {
      name: options.name,
      condition: parseConditionDsl(options.condition),
      holdings: holdingsDsl.map((entry) => parseHoldingDsl(entry)),
      ...(rebalance ? { rebalance } : {}),
    };

    draft.allocations.push(allocation);
    validateDraftForMutationOrThrow(draft);
    await writeLocalStrategyDraftAtomic(options.file, draft);
    return {
      file: options.file,
      allocation,
    };
  });
}
