import type { Action, CashOutRecommendation, HandValue } from "@blackjack/engine";

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
  return rows.map(([label, value]) => `${label.padEnd(width)}  ${value}`).join("\n");
}
