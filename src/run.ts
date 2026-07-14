import {
  BlackjackEngine,
  bundledStrategyPath,
  evaluateHand,
  parseCard,
  type GameState,
} from "@idelahoz/blackjack-engine";
import { describeHand, renderReport } from "./format.js";
import { parseHandOption } from "./hand.js";
import { parseOptions } from "./parse.js";
import { promptForMissing, type Ask } from "./prompt.js";

export interface Io {
  out: (line: string) => void;
  error: (line: string) => void;
}

const REQUIRED_OPTIONS = ["bet", "hand", "dealer"] as const;

/**
 * Executes the `recommend` command. Returns the process exit code so the
 * commander wiring stays trivial and this stays unit-testable.
 *
 * Options omitted as flags are prompted for interactively via `ask`; when no
 * `ask` is available, missing required options are an error.
 */
export async function runRecommend(rawOptions: unknown, io: Io, ask?: Ask): Promise<number> {
  let raw = { ...((rawOptions ?? {}) as Record<string, unknown>) };

  const missing = REQUIRED_OPTIONS.filter((key) => raw[key] === undefined);
  if (missing.length > 0) {
    if (ask === undefined) {
      io.error(`Missing required options: ${missing.map((key) => `--${key}`).join(", ")}`);
      return 1;
    }
    const prompted = await promptForMissing(raw, ask, io);
    if (prompted.isErr()) {
      io.error(prompted.error);
      return 1;
    }
    raw = prompted.value;
  }

  const optionsResult = parseOptions(raw);
  if (optionsResult.isErr()) {
    io.error(optionsResult.error);
    return 1;
  }
  const options = optionsResult.value;

  const handResult = parseHandOption(options.hand);
  if (handResult.isErr()) {
    io.error(handResult.error);
    return 1;
  }
  const dealerResult = parseCard(options.dealer);
  if (dealerResult.isErr()) {
    io.error(`Dealer card: ${dealerResult.error.message}`);
    return 1;
  }

  const strategyPath = options.strategy ?? bundledStrategyPath("s17");
  const engineResult = await BlackjackEngine.create({ strategy: strategyPath });
  if (engineResult.isErr()) {
    io.error(engineResult.error.message);
    return 1;
  }
  const engine = engineResult.value;

  const state: GameState = {
    playerCards: handResult.value.cards,
    dealerUpCard: dealerResult.value,
    ...(handResult.value.canSplit === false ? { canSplit: false } : {}),
  };
  const handValue = evaluateHand(state.playerCards);
  if (handValue.isErr()) {
    io.error(handValue.error.message);
    return 1;
  }

  if (options.cashout !== undefined) {
    const result = engine.evaluateCashOut({
      bet: options.bet,
      cashOut: options.cashout,
      state,
    });
    if (result.isErr()) {
      io.error(result.error.message);
      return 1;
    }
    const { strategyAction, ev, cashOutValue, recommendation } = result.value;
    if (options.json) {
      io.out(
        JSON.stringify(
          {
            hand: options.hand,
            dealer: options.dealer,
            bet: options.bet,
            strategyAction,
            ev,
            cashOut: options.cashout,
            cashOutValue,
            recommendation,
          },
          null,
          2,
        ),
      );
    } else {
      io.out(
        renderReport({
          hand: options.hand,
          handDescription: describeHand(handValue.value),
          dealer: options.dealer,
          action: strategyAction,
          ev,
          cashOut: { offer: options.cashout, value: cashOutValue, recommendation },
        }),
      );
    }
    return 0;
  }

  const actionResult = engine.recommend(state);
  if (actionResult.isErr()) {
    io.error(actionResult.error.message);
    return 1;
  }
  const ev = engine.expectedValue(state);

  if (options.json) {
    io.out(
      JSON.stringify(
        {
          hand: options.hand,
          dealer: options.dealer,
          bet: options.bet,
          strategyAction: actionResult.value,
          ev,
        },
        null,
        2,
      ),
    );
  } else {
    io.out(
      renderReport({
        hand: options.hand,
        handDescription: describeHand(handValue.value),
        dealer: options.dealer,
        action: actionResult.value,
        ev,
      }),
    );
  }
  return 0;
}
