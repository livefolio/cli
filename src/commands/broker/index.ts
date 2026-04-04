import type { Command } from "commander";
import { connectionsAction } from "./connections.js";
import { holdingsAction } from "./holdings.js";
import { activitiesAction } from "./activities.js";
import { ordersAction } from "./orders.js";
import { connectAction } from "./connect.js";

export function registerBroker(program: Command): void {
  const broker = program
    .command("broker")
    .description("Brokerage commands");

  broker
    .command("connections")
    .description("List brokerage connections")
    .action(connectionsAction);

  broker
    .command("holdings <accountId>")
    .description("Get holdings for a brokerage account")
    .action(holdingsAction);

  broker
    .command("activities <accountId>")
    .description("List activities for a brokerage account")
    .action(activitiesAction);

  broker
    .command("orders <accountId>")
    .description("List recent orders for a brokerage account")
    .action(ordersAction);

  broker
    .command("connect")
    .description("Get a connection portal URL")
    .option("--redirect <url>", "Custom redirect URL")
    .action(connectAction);
}
