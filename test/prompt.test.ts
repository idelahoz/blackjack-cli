import { describe, expect, it } from "vitest";
import { promptForMissing, type Ask } from "../src/prompt.js";

/** Scripted stdin: returns queued answers in order, then EOF (null). */
const scripted = (answers: Array<string | null>): Ask => {
  const queue = [...answers];
  return async () => (queue.length > 0 ? queue.shift()! : null);
};

const collectErrors = () => {
  const errors: string[] = [];
  return { errors, io: { error: (line: string) => errors.push(line) } };
};

describe("promptForMissing", () => {
  it("asks for every missing field in order", async () => {
    const { io } = collectErrors();
    const result = await promptForMissing({}, scripted(["100", "A,7", "9", "82"]), io);
    expect(result._unsafeUnwrap()).toMatchObject({
      bet: "100",
      hand: "A,7",
      dealer: "9",
      cashout: "82",
    });
  });

  it("never re-asks values already provided as flags", async () => {
    const { io } = collectErrors();
    const result = await promptForMissing({ bet: "50", cashout: "10" }, scripted(["8,8", "A"]), io);
    expect(result._unsafeUnwrap()).toMatchObject({
      bet: "50",
      hand: "8,8",
      dealer: "A",
      cashout: "10",
    });
  });

  it("re-asks on invalid input, reporting the problem", async () => {
    const { errors, io } = collectErrors();
    const result = await promptForMissing(
      {},
      scripted(["abc", "-5", "100", "22", "16", "X", "9", "nope", ""]),
      io,
    );
    expect(result._unsafeUnwrap()).toMatchObject({ bet: "100", hand: "16", dealer: "9" });
    expect(errors.some((e) => e.includes("positive number"))).toBe(true);
    expect(errors.some((e) => e.includes("between 4 and 21"))).toBe(true);
    expect(errors.some((e) => e.includes("Invalid card"))).toBe(true);
  });

  it("skips the cash-out question on an empty answer", async () => {
    const { io } = collectErrors();
    const result = await promptForMissing({}, scripted(["100", "A,7", "9", ""]), io);
    expect(result._unsafeUnwrap().cashout).toBeUndefined();
  });

  it("errors cleanly when input ends early", async () => {
    const { io } = collectErrors();
    const result = await promptForMissing({}, scripted(["100"]), io);
    expect(result._unsafeUnwrapErr()).toContain("Interactive input ended");
  });

  it("trims whitespace from answers", async () => {
    const { io } = collectErrors();
    const result = await promptForMissing({}, scripted([" 100 ", "  A,7 ", " 9 ", ""]), io);
    expect(result._unsafeUnwrap()).toMatchObject({ bet: "100", hand: "A,7", dealer: "9" });
  });
});
