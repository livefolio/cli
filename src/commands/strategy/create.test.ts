import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAction } from "./create.js";

const validDraft = {
  name: "One Shot",
  trading: { frequency: "Weekly", offset: 0 },
  signals: [
    {
      name: "spy_above_200d",
      signal: {
        left: { type: "Price", ticker: { symbol: "SPY", leverage: 1 }, lookback: 1, delay: 0, unit: "$", threshold: null },
        comparison: ">",
        right: { type: "SMA", ticker: { symbol: "SPY", leverage: 1 }, lookback: 200, delay: 0, unit: "$", threshold: null },
        tolerance: 0,
      },
    },
  ],
  allocations: [
    {
      name: "Default",
      condition: { kind: "not", signalName: "spy_above_200d" },
      holdings: [{ ticker: { symbol: "BIL", leverage: 1 }, weight: 100 }],
    },
  ],
};

let stdout = "";
let stderr = "";
let originalExitCode: number | undefined;

beforeEach(() => {
  stdout = "";
  stderr = "";
  originalExitCode = process.exitCode;
  process.exitCode = undefined;
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    stdout += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
    stderr += String(chunk);
    return true;
  });
});

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

async function tempFile(name: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "livefolio-create-"));
  return join(dir, name);
}

describe("createAction", () => {
  it("creates strategy file from --json", async () => {
    const outFile = await tempFile("strategy.json");
    await createAction({
      file: outFile,
      json: JSON.stringify(validDraft),
    });

    expect(process.exitCode).toBe(0);
    expect(stderr).toBe("");
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.result.file).toBe(outFile);

    const fileContents = JSON.parse(await readFile(outFile, "utf8"));
    expect(fileContents.name).toBe("One Shot");
    expect(fileContents.signals[0].name).toBe("spy_above_200d");
  });

  it("creates strategy file from --json-file", async () => {
    const inFile = await tempFile("input.json");
    const outFile = await tempFile("out.json");
    await writeFile(inFile, JSON.stringify(validDraft), "utf8");

    await createAction({
      file: outFile,
      jsonFile: inFile,
    });

    expect(process.exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.result.file).toBe(outFile);
  });

  it("fails when both --json and --json-file are provided", async () => {
    const outFile = await tempFile("out.json");
    await createAction({
      file: outFile,
      json: "{}",
      jsonFile: "/tmp/whatever.json",
    });

    expect(process.exitCode).toBe(2);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("invalid_create_options");
  });

  it("fails compile checks for incomplete strategies", async () => {
    const outFile = await tempFile("out.json");
    const incomplete = {
      ...validDraft,
      allocations: [],
    };

    await createAction({
      file: outFile,
      json: JSON.stringify(incomplete),
    });

    expect(process.exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("compile_failed");
  });
});

