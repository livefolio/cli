#!/usr/bin/env node
import { program } from "commander";
import { loadEnvFile } from "./config.js";
import { registerMarket } from "./commands/market/index.js";
import { registerStrategy } from "./commands/strategy/index.js";
import { registerAuth } from "./commands/auth/index.js";

const version =
  process.env.npm_package_version ?? (await import("../package.json", { with: { type: "json" } })).default.version;

program
  .name("livefolio")
  .description("Livefolio CLI")
  .version(version)
  .option("--env <path>", "Path to .env file")
  .hook("preAction", () => {
    const envPath = program.opts().env as string | undefined;
    if (envPath) loadEnvFile(envPath);
  });

registerMarket(program);
registerStrategy(program);
registerAuth(program);

program.parse();
