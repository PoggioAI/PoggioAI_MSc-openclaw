/**
 * Pipeline stage constants and human-readable display names.
 *
 * Used by the progress poller to detect stage transitions from stdout
 * and format user-facing status messages.
 */

/** All pipeline stages in execution order. */
export const PIPELINE_STAGES = [
  // Pre-track
  'persona_council',
  'literature_review_agent',
  'brainstorm_agent',
  'formalize_goals_entry',
  'formalize_goals_agent',
  'research_plan_writeup_agent',
  // Theory track (if math enabled)
  'math_literature_agent',
  'math_proposer_agent',
  'math_prover_agent',
  'math_rigorous_verifier_agent',
  'math_empirical_verifier_agent',
  'proof_transcription_agent',
  // Experiment track
  'experiment_literature_agent',
  'experiment_design_agent',
  'experimentation_agent',
  'experiment_verification_agent',
  'experiment_transcription_agent',
  // Post-track
  'track_merge',
  'verify_completion',
  'formalize_results_agent',
  'resource_preparation_agent',
  'pre_writeup_council',
  'narrative_voice',
  'writeup_agent',
  'proofreading_agent',
  'reviewer_agent',
  'persona_post_review',
  // Explore mode stages
  'math_explorer',
  'experiment_explorer',
  'cross_pollinator',
  'explore_evaluator',
] as const;

export type StageName = (typeof PIPELINE_STAGES)[number];

/** Human-friendly display names for progress messages. */
export const STAGE_DISPLAY: Record<string, string> = {
  persona_council: 'Persona Debate (3 perspectives)',
  literature_review_agent: 'Literature Review (adversarial novelty check)',
  brainstorm_agent: 'Brainstorming Approaches',
  formalize_goals_entry: 'Preparing Goal Formalization',
  formalize_goals_agent: 'Formalizing Research Goals',
  research_plan_writeup_agent: 'Writing Research Plan',
  math_literature_agent: 'Math Literature Search',
  math_proposer_agent: 'Proposing Theorems',
  math_prover_agent: 'Constructing Proofs',
  math_rigorous_verifier_agent: 'Adversarial Proof Verification',
  math_empirical_verifier_agent: 'Numerical Sanity Checks',
  proof_transcription_agent: 'Transcribing Proofs to LaTeX',
  experiment_literature_agent: 'Experiment Literature Search',
  experiment_design_agent: 'Designing Experiments',
  experimentation_agent: 'Running Experiments',
  experiment_verification_agent: 'Verifying Results (adversarial)',
  experiment_transcription_agent: 'Transcribing Results',
  track_merge: 'Merging Theory + Experiment Tracks',
  verify_completion: 'Checking Goal Completion',
  formalize_results_agent: 'Formalizing Findings',
  resource_preparation_agent: 'Preparing Figures & Tables',
  writeup_agent: 'Writing Paper (12-pass cycle)',
  proofreading_agent: 'Proofreading & AI-Voice Check',
  reviewer_agent: 'Adversarial Peer Review',
  pre_writeup_council: 'Pre-Writeup Council (2 advisory rounds)',
  narrative_voice: 'Narrative Voice Brief',
  persona_post_review: 'Post-Review Persona Council',
  // Explore mode stages
  math_explorer: 'Math Explorer (iterative investigation)',
  experiment_explorer: 'Experiment Explorer (iterative investigation)',
  cross_pollinator: 'Cross-Pollinator (theory-experiment bridge)',
  explore_evaluator: 'Explore Evaluator (convergence check)',
};

/** Gate/routing node names (not full agent stages, but important for detection). */
export const GATE_NODES = [
  'lit_review_gate',
  'track_decomposition_gate',
  'track_router',
  'milestone_goals',
  'milestone_review',
  'duality_check',
  'followup_lit_review',
  'validation_gate',
] as const;

/**
 * Get display name for a stage, falling back to the raw name.
 */
export function getStageDisplay(stage: string): string {
  return STAGE_DISPLAY[stage] ?? stage.replace(/_/g, ' ');
}

/**
 * Get the index of a stage in the pipeline (1-based), or 0 if not found.
 */
export function getStageIndex(stage: string): number {
  const idx = PIPELINE_STAGES.indexOf(stage as StageName);
  return idx >= 0 ? idx + 1 : 0;
}
