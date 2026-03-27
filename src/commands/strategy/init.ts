import type { LocalStrategyDraft } from "./local-file.js";
import { runStrategyAction } from "./contract.js";
import { writeLocalStrategyDraftAtomic } from "./local-file.js";

const DEFAULT_TEMPLATE: LocalStrategyDraft = {
  name: "New Strategy",
  trading: {
    frequency: "Monthly",
    offset: 0,
  },
  signals: [],
  allocations: [],
};

export async function initAction(options: {
  file?: string;
  name?: string;
}): Promise<void> {
  await runStrategyAction(async () => {
    const filePath = options.file ?? "strategy.json";
    const draft: LocalStrategyDraft = {
      ...DEFAULT_TEMPLATE,
      ...(options.name ? { name: options.name } : {}),
    };
    await writeLocalStrategyDraftAtomic(filePath, draft);
    return {
      file: filePath,
      strategy: draft,
    };
  });
}

