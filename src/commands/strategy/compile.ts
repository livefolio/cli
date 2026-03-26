import { runStrategyAction } from "./contract.js";
import { compileLocalDraftOrThrow } from "./compile-local.js";
import {
  formatCompiledResult,
  readLocalStrategyDraft,
} from "./local-file.js";

export async function compileAction(options: { file: string }): Promise<void> {
  await runStrategyAction(async () => {
    const draft = await readLocalStrategyDraft(options.file);
    const compiled = compileLocalDraftOrThrow(draft);
    return {
      file: options.file,
      ...formatCompiledResult(compiled),
    };
  });
}

