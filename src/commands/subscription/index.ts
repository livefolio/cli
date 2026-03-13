import type { Command } from "commander";
import { subscribeAction } from "./subscribe.js";
import { unsubscribeAction } from "./unsubscribe.js";
import { listAction } from "./list.js";

export function registerSubscription(program: Command): void {
  const subscription = program
    .command("subscription")
    .description("Subscription commands");

  subscription
    .command("subscribe <linkId>")
    .description("Subscribe to a strategy")
    .action(subscribeAction);

  subscription
    .command("unsubscribe <linkId>")
    .description("Unsubscribe from a strategy")
    .action(unsubscribeAction);

  subscription
    .command("list")
    .description("List your subscriptions")
    .action(listAction);
}
