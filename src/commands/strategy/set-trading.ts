import type { Frequency } from "@livefolio/sdk/strategy";
import {
  invalidArgs,
  runStrategyAction,
} from "./contract.js";
import { validateDraftForMutationOrThrow } from "./compile-local.js";
import {
  readLocalStrategyDraft,
  writeLocalStrategyDraftAtomic,
} from "./local-file.js";

const FREQUENCIES: Frequency[] = [
  "Daily",
  "Weekly",
  "Monthly",
  "Bi-monthly",
  "Quarterly",
  "Every 4 Months",
  "Semiannually",
  "Yearly",
];

export async function setTradingAction(options: {
  file: string;
  frequency: string;
  offset: string;
}): Promise<void> {
  await runStrategyAction(async () => {
    if (!FREQUENCIES.includes(options.frequency as Frequency)) {
      throw invalidArgs("invalid_frequency", "Invalid trading frequency.", {
        frequency: options.frequency,
      });
    }
    const offset = Number(options.offset);
    if (!Number.isInteger(offset) || offset < 0) {
      throw invalidArgs("invalid_offset", "offset must be an integer >= 0.", {
        offset: options.offset,
      });
    }

    const draft = await readLocalStrategyDraft(options.file);
    draft.trading = { frequency: options.frequency as Frequency, offset };
    validateDraftForMutationOrThrow(draft);
    await writeLocalStrategyDraftAtomic(options.file, draft);
    return {
      file: options.file,
      trading: draft.trading,
    };
  });
}
