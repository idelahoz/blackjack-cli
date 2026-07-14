import { describe, expect, it } from "vitest";
import { evaluateHand } from "@blackjack/engine";
import { parseHandOption } from "../src/hand.js";

describe("parseHandOption", () => {
  it("still parses comma-separated cards, leaving canSplit alone", () => {
    const result = parseHandOption("A,7")._unsafeUnwrap();
    expect(result.cards).toEqual([{ rank: "A" }, { rank: "7" }]);
    expect(result.canSplit).toBeUndefined();
  });

  it("treats a single numeric value as a hard total with splitting disabled", () => {
    for (let total = 4; total <= 21; total++) {
      const result = parseHandOption(String(total))._unsafeUnwrap();
      const value = evaluateHand(result.cards)._unsafeUnwrap();
      expect(value.total).toBe(total);
      expect(value.isSoft).toBe(false);
      expect(value.isBlackjack).toBe(false);
      expect(result.canSplit).toBe(false);
    }
  });

  it('reads "10" as the hard total ten, not the card', () => {
    const result = parseHandOption("10")._unsafeUnwrap();
    expect(result.cards).toHaveLength(2);
    expect(evaluateHand(result.cards)._unsafeUnwrap().total).toBe(10);
  });

  it("keeps totals 4-20 as two cards so double/surrender remain available", () => {
    expect(parseHandOption("16")._unsafeUnwrap().cards).toHaveLength(2);
    expect(parseHandOption("4")._unsafeUnwrap().cards).toHaveLength(2);
    expect(parseHandOption("21")._unsafeUnwrap().cards).toHaveLength(3);
  });

  it("rejects totals outside 4-21", () => {
    expect(parseHandOption("3")._unsafeUnwrapErr()).toContain("between 4 and 21");
    expect(parseHandOption("22")._unsafeUnwrapErr()).toContain("between 4 and 21");
    expect(parseHandOption("0")._unsafeUnwrapErr()).toContain("between 4 and 21");
  });

  it("rejects non-numeric single tokens as before", () => {
    expect(parseHandOption("A").isErr()).toBe(true);
    expect(parseHandOption("X,Y").isErr()).toBe(true);
  });
});
