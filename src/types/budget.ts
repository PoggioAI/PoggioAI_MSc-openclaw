/**
 * Budget state as written by consortium to budget_state.json.
 */
export interface BudgetState {
  /** Budget cap in USD. */
  usd_limit: number;
  /** Total spend so far in USD. */
  total_usd: number;
  /** Per-model spend breakdown. */
  by_model: Record<string, number>;
  /** ISO timestamp of last update. */
  last_updated: string;
}

/**
 * Single entry in the budget ledger (budget_state.json.ledger).
 */
export interface BudgetEntry {
  call_id: string;
  timestamp: string;
  model_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  total_usd: number;
  usd_limit: number;
}

/**
 * Budget thresholds that trigger user notifications.
 */
export const BUDGET_THRESHOLDS = [0.25, 0.50, 0.75, 0.90] as const;
