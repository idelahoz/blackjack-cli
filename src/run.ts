import { basename } from "node:path";
import {
  BlackjackEngine,
  bundledStrategyPath,
  evaluateHand,
  parseCard,
  type Action,
  type Card,
  type CashOutRecommendation,
  type GameState,
} from "@idelahoz/blackjack-engine";
import { describeHand, renderReport } from "./format.js";
import { parseOptions } from "./parse.js";
import { parseHandOption } from "./hand.js";
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
 *
 * In interactive mode a HIT verdict keeps the hand alive: the drawn card is
 * asked for, folded into the hand, and the position re-evaluated until the
 * hand resolves (stand/double/surrender/cash-out, bust, or Enter to quit).
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

  if (options.strategy !== undefined && options.rules !== undefined) {
    io.error("Use either --rules or --strategy, not both.");
    return 1;
  }
  const strategyPath = options.strategy ?? bundledStrategyPath(options.rules ?? "s17");
  const chart =
    options.rules ?? (options.strategy !== undefined ? basename(options.strategy, ".json") : "s17");
  const engineResult = await BlackjackEngine.create({ strategy: strategyPath });
  if (engineResult.isErr()) {
    io.error(engineResult.error.message);
    return 1;
  }
  const engine = engineResult.value;

  let cards: Card[] = [...handResult.value.cards];
  const forbidSplit = handResult.value.canSplit === false;
  let handLabel = options.hand;
  let cashout: number | undefined = options.cashout;

  for (;;) {
    const state: GameState = {
      playerCards: cards,
      dealerUpCard: dealerResult.value,
      ...(forbidSplit ? { canSplit: false } : {}),
    };
    const handValue = evaluateHand(cards);
    if (handValue.isErr()) {
      io.error(handValue.error.message);
      return 1;
    }

    let action: Action;
    let ev: number;
    let recommendation: CashOutRecommendation | undefined;
    let cashOutBlock:
      { offer: number; value: number; recommendation: CashOutRecommendation } | undefined;

    if (cashout !== undefined) {
      const result = engine.evaluateCashOut({ bet: options.bet, cashOut: cashout, state });
      if (result.isErr()) {
        io.error(result.error.message);
        return 1;
      }
      action = result.value.strategyAction;
      ev = result.value.ev;
      recommendation = result.value.recommendation;
      cashOutBlock = { offer: cashout, value: result.value.cashOutValue, recommendation };
    } else {
      const actionResult = engine.recommend(state);
      if (actionResult.isErr()) {
        io.error(actionResult.error.message);
        return 1;
      }
      action = actionResult.value;
      ev = engine.expectedValue(state);
    }

    if (options.json) {
      io.out(
        JSON.stringify(
          {
            hand: handLabel,
            dealer: options.dealer,
            bet: options.bet,
            chart,
            strategyAction: action,
            ev,
            ...(cashOutBlock !== undefined
              ? {
                  cashOut: cashOutBlock.offer,
                  cashOutValue: cashOutBlock.value,
                  recommendation,
                }
              : {}),
            finalAction: recommendation === "cash_out" ? "cash_out" : action,
          },
          null,
          2,
        ),
      );
      return 0;
    }

    io.out(
      renderReport({
        hand: handLabel,
        handDescription: describeHand(handValue.value),
        dealer: options.dealer,
        action,
        chart,
        ev,
        cashOut: cashOutBlock,
      }),
    );

    // Only a HIT verdict leaves you with another decision to make.
    const handContinues = recommendation !== "cash_out" && action === "hit" && ask !== undefined;
    if (!handContinues) return 0;

    const drawn = await askDrawnCard(ask, io);
    if (drawn === "stop") return 0;
    cards = [...cards, drawn];
    handLabel = `${handLabel} +${drawn.rank}`;

    const afterDraw = evaluateHand(cards);
    if (afterDraw.isOk() && afterDraw.value.isBust) {
      io.out(`\nBust — ${handLabel} is ${afterDraw.value.total}. Hand over.`);
      return 0;
    }

    const offer = await askNextCashout(ask, io);
    if (offer === "stop") return 0;
    cashout = offer;
    io.out("");
  }
}

async function askDrawnCard(ask: Ask, io: Io): Promise<Card | "stop"> {
  for (;;) {
    const answer = await ask("\nCard you drew (press Enter to quit): ");
    if (answer === null) return "stop";
    const value = answer.trim();
    if (value === "") return "stop";
    const card = parseCard(value);
    if (card.isOk()) return card.value;
    io.error(card.error.message);
  }
}

async function askNextCashout(ask: Ask, io: Io): Promise<number | undefined | "stop"> {
  for (;;) {
    const answer = await ask("Cash-out offer (press Enter to skip): ");
    if (answer === null) return "stop";
    const value = answer.trim();
    if (value === "") return undefined;
    const offer = Number(value);
    if (Number.isFinite(offer) && offer >= 0) return offer;
    io.error("Cash-out must be a non-negative number (or press Enter to skip).");
  }
}
