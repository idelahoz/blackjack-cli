import { createInterface, type Interface } from "node:readline";
import { parseCard } from "@idelahoz/blackjack-engine";
import { err, ok, type Result } from "neverthrow";
import { parseHandOption } from "./hand.js";

/** Asks one question; resolves null when interactive input ends (EOF / ctrl-d). */
export type Ask = (question: string) => Promise<string | null>;

export interface Prompter {
  ask: Ask;
  close: () => void;
}

/**
 * Readline-backed prompter for real terminal or piped stdin. The interface is
 * created lazily on the first question so fully-flagged invocations never
 * touch stdin. Line events are buffered in a queue (rather than relying on
 * rl.question) so piped answers that arrive faster than the questions are
 * never dropped.
 */
export function createConsoleAsk(): Prompter {
  let rl: Interface | undefined;
  const lines: string[] = [];
  let closed = false;
  let notify: (() => void) | undefined;

  const get = () => {
    if (rl === undefined) {
      rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.on("line", (line) => {
        lines.push(line);
        notify?.();
      });
      rl.on("close", () => {
        closed = true;
        notify?.();
      });
    }
    return rl;
  };

  return {
    ask: async (question) => {
      get();
      process.stdout.write(question);
      while (lines.length === 0) {
        if (closed) return null;
        await new Promise<void>((resolve) => {
          notify = resolve;
        });
        notify = undefined;
      }
      return lines.shift() as string;
    },
    close: () => rl?.close(),
  };
}

interface IoLike {
  error: (line: string) => void;
}

type Validator = (value: string) => string | null;

const validateBet: Validator = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? null : "Bet must be a positive number.";
};

const validateHand: Validator = (value) => {
  const result = parseHandOption(value);
  return result.isOk() ? null : result.error;
};

const validateDealer: Validator = (value) => {
  const result = parseCard(value);
  return result.isOk() ? null : result.error.message;
};

const validateCashout: Validator = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0
    ? null
    : "Cash-out must be a non-negative number (or press Enter to skip).";
};

async function askUntilValid(
  ask: Ask,
  io: IoLike,
  question: string,
  validate: Validator,
): Promise<string | null> {
  for (;;) {
    const answer = await ask(question);
    if (answer === null) return null;
    const value = answer.trim();
    const problem = validate(value);
    if (problem === null) return value;
    io.error(problem);
  }
}

const ABORTED = "Interactive input ended before all values were provided.";

/**
 * Fills any missing recommend options by asking for them. Only fields that
 * are absent get prompted; values passed as flags are never re-asked. The
 * optional cash-out question is skipped with an empty answer.
 */
export async function promptForMissing(
  raw: Record<string, unknown>,
  ask: Ask,
  io: IoLike,
): Promise<Result<Record<string, unknown>, string>> {
  const filled = { ...raw };

  if (filled.bet === undefined) {
    const value = await askUntilValid(ask, io, "Bet amount: ", validateBet);
    if (value === null) return err(ABORTED);
    filled.bet = value;
  }
  if (filled.hand === undefined) {
    const value = await askUntilValid(
      ask,
      io,
      'Your hand ("A,7", "A 7", or a hard total like "16"): ',
      validateHand,
    );
    if (value === null) return err(ABORTED);
    filled.hand = value;
  }
  if (filled.dealer === undefined) {
    const value = await askUntilValid(ask, io, "Dealer up card: ", validateDealer);
    if (value === null) return err(ABORTED);
    filled.dealer = value;
  }
  if (filled.cashout === undefined) {
    for (;;) {
      const answer = await ask("Cash-out offer (press Enter to skip): ");
      if (answer === null) return err(ABORTED);
      const value = answer.trim();
      if (value === "") break;
      const problem = validateCashout(value);
      if (problem === null) {
        filled.cashout = value;
        break;
      }
      io.error(problem);
    }
  }

  return ok(filled);
}
