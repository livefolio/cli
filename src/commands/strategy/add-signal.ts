import type { Comparison } from "@livefolio/sdk/strategy";
import {
  invalidArgs,
  runStrategyAction,
} from "./contract.js";
import { validateDraftForMutationOrThrow } from "./compile-local.js";
import { isValidSignalIdentifier, parseIndicatorDsl } from "./dsl.js";
import {
  readLocalStrategyDraft,
  writeLocalStrategyDraftAtomic,
} from "./local-file.js";

const COMPARISONS: Comparison[] = [">", "<", "="];

export async function addSignalAction(options: {
  file: string;
  name: string;
  left: string;
  comparison: string;
  right: string;
  tolerance?: string;
}): Promise<void> {
  await runStrategyAction(async () => {
    if (!isValidSignalIdentifier(options.name)) {
      throw invalidArgs(
        "invalid_signal_name",
        "Signal names must match [A-Za-z_][A-Za-z0-9_-]*.",
        { name: options.name },
      );
    }
    if (!COMPARISONS.includes(options.comparison as Comparison)) {
      throw invalidArgs("invalid_comparison", "comparison must be one of >, <, =.", {
        comparison: options.comparison,
      });
    }
    const tolerance =
      options.tolerance == null || options.tolerance === ""
        ? 0
        : Number(options.tolerance);
    if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 100) {
      throw invalidArgs("invalid_tolerance", "tolerance must be between 0 and 100.", {
        tolerance: options.tolerance,
      });
    }

    const draft = await readLocalStrategyDraft(options.file);
    if (draft.signals.some((signal) => signal.name === options.name)) {
      throw invalidArgs("duplicate_signal_name", "Signal name already exists.", {
        name: options.name,
      });
    }

    draft.signals.push({
      name: options.name,
      signal: {
        left: parseIndicatorDsl(options.left),
        comparison: options.comparison as Comparison,
        right: parseIndicatorDsl(options.right),
        tolerance,
      },
    });
    validateDraftForMutationOrThrow(draft);
    await writeLocalStrategyDraftAtomic(options.file, draft);
    return {
      file: options.file,
      signal: draft.signals[draft.signals.length - 1],
    };
  });
}
