import {
  runStrategyAction,
} from "./contract.js";
import { validateDraftForMutationOrThrow } from "./compile-local.js";
import {
  ensureNoSignalReferences,
  ensureSignalExists,
  readLocalStrategyDraft,
  writeLocalStrategyDraftAtomic,
} from "./local-file.js";

export async function removeSignalAction(options: {
  file: string;
  name: string;
}): Promise<void> {
  await runStrategyAction(async () => {
    const draft = await readLocalStrategyDraft(options.file);
    ensureSignalExists(draft, options.name);
    ensureNoSignalReferences(draft, options.name);
    draft.signals = draft.signals.filter((signal) => signal.name !== options.name);
    validateDraftForMutationOrThrow(draft);
    await writeLocalStrategyDraftAtomic(options.file, draft);
    return {
      file: options.file,
      removed: {
        signal: options.name,
      },
    };
  });
}
