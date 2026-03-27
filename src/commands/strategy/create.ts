import { readFile } from "node:fs/promises";
import {
  invalidArgs,
  notFound,
  parseOrCompileFailure,
  runStrategyAction,
} from "./contract.js";
import { compileLocalDraftOrThrow } from "./compile-local.js";
import {
  parseLocalStrategyDraft,
  writeLocalStrategyDraftAtomic,
} from "./local-file.js";

async function loadJsonFromSource(options: {
  json?: string;
  jsonFile?: string;
}): Promise<unknown> {
  if (options.json && options.jsonFile) {
    throw invalidArgs(
      "invalid_create_options",
      "Use either --json or --json-file, not both.",
    );
  }
  if (!options.json && !options.jsonFile) {
    throw invalidArgs(
      "invalid_create_options",
      "Either --json or --json-file is required.",
    );
  }

  if (options.jsonFile) {
    let content: string;
    try {
      content = await readFile(options.jsonFile, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw notFound("file_not_found", "JSON input file not found.", {
          file: options.jsonFile,
        });
      }
      throw err;
    }
    try {
      return JSON.parse(content);
    } catch (err) {
      throw parseOrCompileFailure(
        "invalid_json",
        "JSON input file is not valid JSON.",
        {
          file: options.jsonFile,
          cause: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }

  try {
    return JSON.parse(options.json as string);
  } catch (err) {
    throw parseOrCompileFailure(
      "invalid_json",
      "Inline --json value is not valid JSON.",
      { cause: err instanceof Error ? err.message : String(err) },
    );
  }
}

export async function createAction(options: {
  file: string;
  json?: string;
  jsonFile?: string;
}): Promise<void> {
  await runStrategyAction(async () => {
    const raw = await loadJsonFromSource(options);
    const draft = parseLocalStrategyDraft(
      raw,
      options.jsonFile ?? "--json",
    );

    // One-shot create expects a fully valid strategy.
    compileLocalDraftOrThrow(draft);
    await writeLocalStrategyDraftAtomic(options.file, draft);

    return {
      file: options.file,
      strategy: draft,
    };
  });
}

