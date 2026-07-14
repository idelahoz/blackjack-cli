import { Command } from "commander";
import { runRecommend } from "./run.js";

const program = new Command();

program
  .name("blackjack")
  .description("Blackjack basic-strategy and cash-out recommendations")
  .version("0.1.0");

program
  .command("recommend")
  .description("Recommend a move (and optionally a cash-out decision) for a hand")
  .requiredOption("--bet <amount>", "original bet amount")
  .requiredOption("--hand <cards>", 'player cards, comma separated (e.g. "A,7")')
  .requiredOption("--dealer <card>", "dealer up card (e.g. 9, J, A)")
  .option("--cashout <amount>", "cash-out offer to compare against continuing")
  .option("--strategy <path>", "path to a strategy JSON file (default: bundled s17.json)")
  .option("--json", "print machine-readable JSON")
  .action(async (options: unknown) => {
    process.exitCode = await runRecommend(options, {
      out: (line) => console.log(line),
      error: (line) => console.error(line),
    });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
