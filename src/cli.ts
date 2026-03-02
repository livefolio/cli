#!/usr/bin/env node
import { program } from "commander";

const version =
  process.env.npm_package_version ?? (await import("../package.json", { with: { type: "json" } })).default.version;

program
  .name("livefolio")
  .description("Livefolio CLI")
  .version(version);

program.parse();
