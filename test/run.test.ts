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

  it("accepts a custom strategy file (bundled h17)", async () => {
    const { bundledStrategyPath } = await import("@blackjack/engine");
    const io = capture();
    const code = await runRecommend(
      { bet: "100", hand: "5,6", dealer: "A", strategy: bundledStrategyPath("h17") },
      io,
    );
    expect(code).toBe(0);
    expect(io.lines.join("\n")).toContain("Double"); // 11 vs A doubles under H17
  });
});
