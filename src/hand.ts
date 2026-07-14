import { parseHand, type Card, type Rank } from "@idelahoz/blackjack-engine";
import { err, ok, type Result } from "neverthrow";

export interface HandInput {
  cards: Card[];
  /** Set to false for hard-total inputs so the synthetic cards never hit the pair table. */
  canSplit?: boolean;
}

/**
 * Parses the --hand option. Two forms are accepted:
 *  - cards separated by commas and/or spaces: "A,7", "A 7", "10 J 3"
 *  - a single numeric value: "16" — treated as a HARD TOTAL and mapped to a
 *    representative two-card hand (splitting disabled). Note that "10" is the
 *    hard total ten, not the card; a single card is never a valid hand.
 */
export function parseHandOption(input: string): Result<HandInput, string> {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    const total = Number(trimmed);
    if (total < 4 || total > 21) {
      return err(`Hard total must be between 4 and 21, got "${trimmed}"`);
    }
    return ok({ cards: cardsForHardTotal(total), canSplit: false });
  }
  return parseHand(trimmed)
    .map((cards) => ({ cards }))
    .mapErr((error) => error.message);
}

/**
 * Representative cards for a hard total. Totals 4-20 map to a two-card hand
 * (so doubling/surrender stay available, matching a "first two cards" read);
 * hard 21 cannot be made with two cards without being a natural, so it uses
 * three.
 */
function cardsForHardTotal(total: number): Card[] {
  if (total === 21) {
    return [{ rank: "10" }, { rank: "9" }, { rank: "2" }];
  }
  if (total >= 12) {
    return [{ rank: "10" }, { rank: String(total - 10) as Rank }];
  }
  return [{ rank: String(total - 2) as Rank }, { rank: "2" }];
}
