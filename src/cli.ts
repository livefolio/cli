#!/usr/bin/env node
import { program, type Command } from "commander";
import { loadEnvFile, requireAuth } from "./config.js";
import { registerAuth } from "./commands/auth/index.js";
import { registerMarket } from "./commands/market/index.js";
import { registerStrategy } from "./commands/strategy/index.js";

const version =
  process.env.npm_package_version ?? (await import("../package.json", { with: { type: "json" } })).default.version;

function isAuthCommand(cmd: Command): boolean {
  let current: Command | null = cmd;
  while (current) {
    if (current.name() === "auth") return true;
    current = current.parent;
  }
  return false;
}

program
  .name("livefolio")
  .description("Livefolio CLI")
  .version(version)
  .option("--env <path>", "Path to .env file")
  .hook("preAction", async (_thisCommand, actionCommand) => {
    const envPath = program.opts().env as string | undefined;
    if (envPath) loadEnvFile(envPath);

    if (!isAuthCommand(actionCommand)) {
      await requireAuth();
    }
  });

registerAuth(program);
registerMarket(program);
registerStrategy(program);

program.parse();
