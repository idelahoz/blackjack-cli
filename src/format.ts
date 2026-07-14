import type { Action, CashOutRecommendation, HandValue } from "@idelahoz/blackjack-engine";

const ACTION_LABELS: Record<Action, string> = {
  hit: "Hit",
  stand: "Stand",
  double: "Double",
  split: "Split",
  surrender: "Surrender",
};

export const formatAction = (action: Action): string => ACTION_LABELS[action];

export const formatRecommendation = (recommendation: CashOutRecommendation): string =>
  recommendation === "cash_out" ? "Cash Out" : "Continue";

export const describeHand = (value: HandValue): string => {
  if (value.isBlackjack) return "blackjack";
  return `${value.isSoft ? "soft" : "hard"} ${value.total}`;
};

export interface ReportInput {
  hand: string;
  handDescription: string;
  dealer: string;
  action: Action;
  ev: number;
  cashOut?: {
    offer: number;
    value: number;
    recommendation: CashOutRecommendation;
  };
}

/**
 * The single move to make once every engine has weighed in: the cash-out
 * recommendation overrides the table action.
 */
export function finalAction(action: Action, recommendation?: CashOutRecommendation): string {
  return recommendation === "cash_out" ? "CASH OUT" : formatAction(action).toUpperCase();
}

/** Renders the human-readable report shown by `blackjack recommend`. */
export function renderReport(input: ReportInput): string {
  const rows: Array<[string, string]> = [
    ["Current Hand", `${input.hand} (${input.handDescription})`],
    ["Dealer", input.dealer],
    ["Strategy", formatAction(input.action)],
    ["Expected Value", input.ev.toFixed(2)],
  ];
  if (input.cashOut) {
    rows.push(
      ["Cash Out", `${input.cashOut.offer} (${input.cashOut.value.toFixed(2)} units)`],
      ["Recommendation", formatRecommendation(input.cashOut.recommendation)],
    );
  }
  const width = Math.max(...rows.map(([label]) => label.length));
  const report = rows.map(([label, value]) => `${label.padEnd(width)}  ${value}`).join("\n");
  return `${report}\n\nNow you must ${finalAction(input.action, input.cashOut?.recommendation)}`;
}
