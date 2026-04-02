#!/usr/bin/env node
import { Command } from "commander";
import { makeIndicatorCommand } from "./commands/indicator";
import { makeSignalCommand } from "./commands/signal";
import { makeStrategyCommand } from "./commands/strategy";

const program = new Command();

program.name("livefolio").description("Livefolio CLI").version("0.0.1");

program.addCommand(makeIndicatorCommand());
program.addCommand(makeSignalCommand());
program.addCommand(makeStrategyCommand());

program.parseAsync();
