#!/usr/bin/env node
import { Command } from "commander";
import { makeIndicatorCommand } from "./commands/indicator.js";

const program = new Command();

program.name("livefolio").description("Livefolio CLI").version("0.0.1");

program.addCommand(makeIndicatorCommand());

program.parse();
