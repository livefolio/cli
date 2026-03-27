import {
  runStrategyAction,
} from "./contract.js";
import { validateDraftForMutationOrThrow } from "./compile-local.js";
import {
  ensureAllocationExists,
  readLocalStrategyDraft,
  writeLocalStrategyDraftAtomic,
} from "./local-file.js";

export async function removeAllocationAction(options: {
  file: string;
  name: string;
}): Promise<void> {
  await runStrategyAction(async () => {
    const draft = await readLocalStrategyDraft(options.file);
    ensureAllocationExists(draft, options.name);
    draft.allocations = draft.allocations.filter((allocation) => allocation.name !== options.name);
    validateDraftForMutationOrThrow(draft);
    await writeLocalStrategyDraftAtomic(options.file, draft);
    return {
      file: options.file,
      removed: {
        allocation: options.name,
      },
    };
  });
}
