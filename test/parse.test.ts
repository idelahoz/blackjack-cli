import { describe, expect, it } from "vitest";
import { parseOptions } from "../src/parse.js";

describe("parseOptions", () => {
  it("coerces string option values from commander", () => {
    const options = parseOptions({
      bet: "100",
      hand: "A,7",
      dealer: "9",
      cashout: "82",
    })._unsafeUnwrap();
    expect(options).toMatchObject({ bet: 100, cashout: 82, json: false });
  });

  it("allows omitting cashout and strategy", () => {
    const options = parseOptions({ bet: "50", hand: "8,8", dealer: "A" })._unsafeUnwrap();
    expect(options.cashout).toBeUndefined();
    expect(options.strategy).toBeUndefined();
  });

  it("rejects non-numeric bets", () => {
    const result = parseOptions({ bet: "abc", hand: "A,7", dealer: "9" });
    expect(result._unsafeUnwrapErr()).toContain("--bet");
  });

  it("rejects non-positive bets", () => {
    expect(parseOptions({ bet: "0", hand: "A,7", dealer: "9" }).isErr()).toBe(true);
    expect(parseOptions({ bet: "-10", hand: "A,7", dealer: "9" }).isErr()).toBe(true);
  });

  it("rejects negative cash-out offers", () => {
    const result = parseOptions({ bet: "100", hand: "A,7", dealer: "9", cashout: "-1" });
    expect(result._unsafeUnwrapErr()).toContain("--cashout");
  });

  it("rejects missing hand or dealer", () => {
    expect(parseOptions({ bet: "100", dealer: "9" }).isErr()).toBe(true);
    expect(parseOptions({ bet: "100", hand: "A,7" }).isErr()).toBe(true);
  });
});
