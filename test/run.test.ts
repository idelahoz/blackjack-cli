import { describe, expect, it } from "vitest";
import { runRecommend, type Io } from "../src/run.js";

interface Capture extends Io {
  lines: string[];
  errors: string[];
}

const capture = (): Capture => {
  const lines: string[] = [];
  const errors: string[] = [];
  return {
    lines,
    errors,
    out: (line) => lines.push(line),
    error: (line) => errors.push(line),
  };
};

describe("runRecommend (end-to-end against the bundled s17 strategy)", () => {
  it("prints the full cash-out report", async () => {
    const io = capture();
    const code = await runRecommend({ bet: "100", hand: "A,7", dealer: "9", cashout: "82" }, io);
    expect(code).toBe(0);
    const output = io.lines.join("\n");
    expect(output).toContain("Current Hand");
    expect(output).toContain("A,7 (soft 18)");
    expect(output).toContain("Strategy");
    expect(output).toContain("Hit"); // S17 chart: soft 18 vs 9 = hit
    expect(output).toContain("Expected Value");
    expect(output).toContain("Cash Out");
    expect(output).toMatch(/Recommendation\s+(Continue|Cash Out)/);
  });

  it("omits the cash-out section when no offer is given", async () => {
    const io = capture();
    const code = await runRecommend({ bet: "100", hand: "A,7", dealer: "9" }, io);
    expect(code).toBe(0);
    const output = io.lines.join("\n");
    expect(output).toContain("Strategy");
    expect(output).not.toContain("Recommendation");
  });

  it("recommends splitting eights", async () => {
    const io = capture();
    await runRecommend({ bet: "100", hand: "8,8", dealer: "10" }, io);
    expect(io.lines.join("\n")).toContain("Split");
  });

  it("recommends surrendering 16 vs 10", async () => {
    const io = capture();
    await runRecommend({ bet: "100", hand: "10,6", dealer: "10" }, io);
    expect(io.lines.join("\n")).toContain("Surrender");
  });

  it("ends with the strategy action as the final verdict when continuing", async () => {
    const io = capture();
    await runRecommend({ bet: "100", hand: "A,7", dealer: "9", cashout: "50" }, io);
    const output = io.lines.join("\n");
    expect(output.trimEnd().endsWith("Now you must HIT")).toBe(true);
  });

  it("ends with CASH OUT when the offer beats the EV", async () => {
    const io = capture();
    await runRecommend({ bet: "100", hand: "10,6", dealer: "10", cashout: "55" }, io);
    const output = io.lines.join("\n");
    expect(output).toContain("Recommendation");
    expect(output.trimEnd().endsWith("Now you must CASH OUT")).toBe(true);
  });

  it("shows the verdict even without a cash-out offer", async () => {
    const io = capture();
    await runRecommend({ bet: "100", hand: "8,8", dealer: "10" }, io);
    expect(io.lines.join("\n").trimEnd().endsWith("Now you must SPLIT")).toBe(true);
  });

  it("treats a single numeric --hand as a hard total", async () => {
    const io = capture();
    const code = await runRecommend({ bet: "100", hand: "16", dealer: "10" }, io);
    expect(code).toBe(0);
    const output = io.lines.join("\n");
    expect(output).toContain("16 (hard 16)");
    expect(output).toContain("Surrender");
  });

  it("never splits a hard-total input, even when it lands on a pair", async () => {
    const io = capture();
    await runRecommend({ bet: "100", hand: "4", dealer: "2" }, io); // maps to 2,2
    expect(io.lines.join("\n")).toContain("Hit"); // hard 4, not the 2,2 split row
  });

  it("doubles a hard-total 11 vs 6", async () => {
    const io = capture();
    await runRecommend({ bet: "100", hand: "11", dealer: "6" }, io);
    expect(io.lines.join("\n")).toContain("Double");
  });

  it("rejects out-of-range hard totals", async () => {
    const io = capture();
    const code = await runRecommend({ bet: "100", hand: "22", dealer: "6" }, io);
    expect(code).toBe(1);
    expect(io.errors.join("\n")).toContain("between 4 and 21");
  });

  it("emits machine-readable JSON with --json", async () => {
    const io = capture();
    const code = await runRecommend(
      { bet: "100", hand: "A,7", dealer: "9", cashout: "82", json: true },
      io,
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(io.lines.join("\n")) as Record<string, unknown>;
    expect(parsed.strategyAction).toBe("hit");
    expect(typeof parsed.ev).toBe("number");
    expect(parsed.cashOutValue).toBeCloseTo(0.82, 10);
    expect(["continue", "cash_out"]).toContain(parsed.recommendation);
  });

  it("fails with exit code 1 on an invalid card", async () => {
    const io = capture();
    const code = await runRecommend({ bet: "100", hand: "A,X", dealer: "9" }, io);
    expect(code).toBe(1);
    expect(io.errors.join("\n")).toContain("Invalid card");
  });

  it("fails with exit code 1 on an invalid bet", async () => {
    const io = capture();
    const code = await runRecommend({ bet: "-1", hand: "A,7", dealer: "9" }, io);
    expect(code).toBe(1);
  });

  it("fails with exit code 1 when the strategy file is missing", async () => {
    const io = capture();
    const code = await runRecommend(
      { bet: "100", hand: "A,7", dealer: "9", strategy: "/nope/missing.json" },
      io,
    );
    expect(code).toBe(1);
    expect(io.errors.join("\n")).toContain("Cannot read strategy file");
  });

  it("fails with a helpful message when flags are missing and no prompt is available", async () => {
    const io = capture();
    const code = await runRecommend({ bet: "100" }, io);
    expect(code).toBe(1);
    expect(io.errors.join("\n")).toContain("Missing required options: --hand, --dealer");
  });

  it("prompts for missing values when an ask function is provided", async () => {
    const io = capture();
    const answers = ["100", "A,7", "9", "82"];
    const code = await runRecommend({}, io, async () => answers.shift() ?? null);
    expect(code).toBe(0);
    const output = io.lines.join("\n");
    expect(output).toContain("A,7 (soft 18)");
    expect(output).toMatch(/Recommendation\s+(Continue|Cash Out)/);
  });

  it("only prompts for the values not passed as flags", async () => {
    const io = capture();
    const answers = ["10,6", "10", ""];
    const code = await runRecommend({ bet: "100" }, io, async () => answers.shift() ?? null);
    expect(code).toBe(0);
    expect(answers).toHaveLength(0); // hand, dealer, cashout-skip all consumed
    expect(io.lines.join("\n")).toContain("Surrender");
  });

  it("continues the hand after a HIT verdict: draw, re-evaluate, then stand", async () => {
    const io = capture();
    // 9,3 (12) vs 10 → HIT; draw 8 → 20 vs 10 → STAND ends the loop.
    const answers = ["8", ""];
    const code = await runRecommend({ bet: "100", hand: "9,3", dealer: "10" }, io, async (q) =>
      q.includes("Card you drew") || q.includes("Cash-out") ? (answers.shift() ?? null) : null,
    );
    expect(code).toBe(0);
    const output = io.lines.join("\n");
    expect(output).toContain("9,3 (hard 12)");
    expect(output).toContain("9,3 +8 (hard 20)");
    expect(output.trimEnd().endsWith("Now you must STAND")).toBe(true);
  });

  it("ends the hand on a bust after drawing", async () => {
    const io = capture();
    const answers = ["10"]; // 9,3 (12) + 10 = 22
    const code = await runRecommend(
      { bet: "100", hand: "9,3", dealer: "10" },
      io,
      async () => answers.shift() ?? null,
    );
    expect(code).toBe(0);
    const output = io.lines.join("\n");
    expect(output).toContain("Bust — 9,3 +10 is 22. Hand over.");
  });

  it("stops cleanly when Enter is pressed at the draw prompt", async () => {
    const io = capture();
    const answers = [""];
    const code = await runRecommend(
      { bet: "100", hand: "9,3", dealer: "10" },
      io,
      async () => answers.shift() ?? null,
    );
    expect(code).toBe(0);
    expect(io.lines.join("\n")).toContain("Now you must HIT");
  });

  it("can cash out mid-hand with a fresh offer after drawing", async () => {
    const io = capture();
    // 9,3 vs 10 → HIT; draw 2 → 14 vs 10 (EV ≈ 0.47); offer 80 → CASH OUT.
    const answers = ["2", "80"];
    const code = await runRecommend(
      { bet: "100", hand: "9,3", dealer: "10" },
      io,
      async () => answers.shift() ?? null,
    );
    expect(code).toBe(0);
    const output = io.lines.join("\n");
    expect(output).toContain("9,3 +2 (hard 14)");
    expect(output.trimEnd().endsWith("Now you must CASH OUT")).toBe(true);
  });

  it("does not loop without an interactive ask (flags-only)", async () => {
    const io = capture();
    const code = await runRecommend({ bet: "100", hand: "9,3", dealer: "10" }, io);
    expect(code).toBe(0);
    expect(io.lines.join("\n").trimEnd().endsWith("Now you must HIT")).toBe(true);
  });

  it("defaults to the h17 chart (11 vs A doubles)", async () => {
    const io = capture();
    const code = await runRecommend({ bet: "100", hand: "5,6", dealer: "A" }, io);
    expect(code).toBe(0);
    const output = io.lines.join("\n");
    expect(output).toContain("Double (h17)");
    expect(output.trimEnd().endsWith("Now you must DOUBLE")).toBe(true);
  });

  it("switches charts with --rules s17 (11 vs A hits)", async () => {
    const io = capture();
    const code = await runRecommend({ bet: "100", hand: "5,6", dealer: "A", rules: "s17" }, io);
    expect(code).toBe(0);
    expect(io.lines.join("\n")).toContain("Hit (s17)");
  });

  it("rejects invalid --rules values", async () => {
    const io = capture();
    const code = await runRecommend({ bet: "100", hand: "5,6", dealer: "A", rules: "x17" }, io);
    expect(code).toBe(1);
    expect(io.errors.join("\n")).toContain("--rules");
  });

  it("rejects --rules combined with --strategy", async () => {
    const io = capture();
    const code = await runRecommend(
      { bet: "100", hand: "5,6", dealer: "A", rules: "s17", strategy: "custom.json" },
      io,
    );
    expect(code).toBe(1);
    expect(io.errors.join("\n")).toContain("not both");
  });

  it("accepts a custom strategy file (bundled h17)", async () => {
    const { bundledStrategyPath } = await import("@idelahoz/blackjack-engine");
    const io = capture();
    const code = await runRecommend(
      { bet: "100", hand: "5,6", dealer: "A", strategy: bundledStrategyPath("h17") },
      io,
    );
    expect(code).toBe(0);
    expect(io.lines.join("\n")).toContain("Double"); // 11 vs A doubles under H17
  });
});
