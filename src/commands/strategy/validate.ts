import { runStrategyAction } from "./contract.js";
import { compileLocalDraftOrThrow } from "./compile-local.js";
import { readLocalStrategyDraft } from "./local-file.js";

export async function validateAction(options: { file: string }): Promise<void> {
  await runStrategyAction(async () => {
    const draft = await readLocalStrategyDraft(options.file);
    compileLocalDraftOrThrow(draft);
    return {
      file: options.file,
      valid: true,
    };
  });
}

