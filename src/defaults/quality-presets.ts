import { PipelineOptions } from '../types/pipeline.js';

/**
 * Quality presets — predefined configurations that maximize paper quality
 * with zero user tuning. These are the result of extensive backtesting
 * against the Claude skill orchestrator (SKILL.md).
 *
 * QUALITY_MAX: Best possible paper. Everything turned to 11.
 * Uses Opus, counsel, math agents, tree search, strict review gates,
 * 5-round persona debate, 12-pass writeup, 2 ideation cycles.
 * Per-phase pass limits match the SKILL.md multi-pass execution protocol.
 * Cost: ~$100-300 | Time: 3-8 hours
 *
 * QUALITY_FAST: Quick draft. Uses Sonnet, no counsel, no math,
 * relaxed gates, markdown output.
 * Cost: ~$5-15 | Time: 20-60 minutes
 */

type PresetDefaults = Omit<PipelineOptions, 'task' | 'styleGuidePath' | 'resumePath'>;

/**
 * Per-phase pass limits from SKILL.md (lines 676-700).
 * null max means unbounded — the orchestrator loops until the subagent
 * reports completion or stall detection triggers.
 */
const PASS_LIMITS_MAX: Record<string, { min: number; max: number | null }> = {
  persona_council:          { min: 1,  max: 1 },
  literature_review:        { min: 2,  max: 5 },
  brainstorm:               { min: 2,  max: 5 },
  formalize_goals:          { min: 2,  max: 5 },
  research_plan_writeup:    { min: 2,  max: 3 },
  math_literature:          { min: 2,  max: null },
  math_proposer:            { min: 2,  max: null },
  math_prover:              { min: 2,  max: null },
  math_verifier:            { min: 2,  max: null },
  experiment_design:        { min: 2,  max: 5 },
  experimentation:          { min: 2,  max: null },
  experiment_verify:        { min: 2,  max: null },
  track_merge:              { min: 2,  max: 3 },
  verify_completion:        { min: 1,  max: 1 },
  formalize_results:        { min: 2,  max: 5 },
  duality_check:            { min: 1,  max: 1 },
  resource_prep:            { min: 2,  max: 3 },
  writeup:                  { min: 12, max: 12 },
  proofreading:             { min: 2,  max: 5 },
  reviewer:                 { min: 1,  max: 1 },
  persona_post_review:      { min: 1,  max: 1 },
};

const PASS_LIMITS_FAST: Record<string, { min: number; max: number | null }> = {
  persona_council:          { min: 1,  max: 1 },
  literature_review:        { min: 1,  max: 2 },
  brainstorm:               { min: 1,  max: 2 },
  formalize_goals:          { min: 1,  max: 2 },
  research_plan_writeup:    { min: 1,  max: 1 },
  math_literature:          { min: 1,  max: 2 },
  math_proposer:            { min: 1,  max: 2 },
  math_prover:              { min: 1,  max: 2 },
  math_verifier:            { min: 1,  max: 2 },
  experiment_design:        { min: 1,  max: 2 },
  experimentation:          { min: 1,  max: 2 },
  experiment_verify:        { min: 1,  max: 2 },
  track_merge:              { min: 1,  max: 1 },
  verify_completion:        { min: 1,  max: 1 },
  formalize_results:        { min: 1,  max: 2 },
  duality_check:            { min: 1,  max: 1 },
  resource_prep:            { min: 1,  max: 1 },
  writeup:                  { min: 3,  max: 3 },
  proofreading:             { min: 1,  max: 2 },
  reviewer:                 { min: 1,  max: 1 },
  persona_post_review:      { min: 1,  max: 1 },
};

export const QUALITY_MAX: PresetDefaults = {
  preset: 'max-quality',
  model: 'claude-opus-4-6',
  budgetUsd: 300,
  outputFormat: 'latex',
  mode: 'local',

  // Quality features: ALL ON — no exceptions
  enableMathAgents: true,
  enableCounsel: true,
  enableTreeSearch: true,
  enableExploreMode: false,
  dryRun: false,

  // Review gates: maximum strictness
  minReviewScore: 7,
  requirePdf: true,
  enforcePaperArtifacts: true,
  enforceEditorialArtifacts: true,

  // Iterations: match SKILL.md multi-pass protocol
  followupMaxIterations: 5,
  personaDebateRounds: 5,
  counselMaxDebateRounds: 5,
  writeupPasses: 12,
  minPassesPerPhase: 2,
  maxIdeationCycles: 2,
  preWriteupDebateRounds: 2,
  postReviewDebateRounds: 2,

  // Per-phase pass limits (from SKILL.md table)
  passLimits: PASS_LIMITS_MAX,
};

export const QUALITY_FAST: PresetDefaults = {
  preset: 'fast',
  model: 'claude-sonnet-4-6',
  budgetUsd: 25,
  outputFormat: 'markdown',
  mode: 'local',

  // Quality features: minimal
  enableMathAgents: false,
  enableCounsel: false,
  enableTreeSearch: false,
  enableExploreMode: false,
  dryRun: false,

  // Review gates: relaxed
  minReviewScore: 5,
  requirePdf: false,
  enforcePaperArtifacts: false,
  enforceEditorialArtifacts: false,

  // Iterations: conservative
  followupMaxIterations: 2,
  personaDebateRounds: 2,
  counselMaxDebateRounds: 2,
  writeupPasses: 3,
  minPassesPerPhase: 1,
  maxIdeationCycles: 1,
  preWriteupDebateRounds: 1,
  postReviewDebateRounds: 1,

  // Per-phase pass limits (relaxed)
  passLimits: PASS_LIMITS_FAST,
};

/**
 * Resolve a preset name to its defaults.
 */
export function getPreset(name: string): PresetDefaults {
  switch (name) {
    case 'fast':
      return { ...QUALITY_FAST };
    case 'max-quality':
    default:
      return { ...QUALITY_MAX };
  }
}

/**
 * Merge user-provided flags over a preset. User flags always win.
 */
export function resolveOptions(
  task: string,
  preset: string,
  overrides: Partial<PipelineOptions>,
): PipelineOptions {
  const base = getPreset(preset);
  return {
    ...base,
    ...overrides,
    task,
    // Ensure task is never overridden by preset
    preset: (overrides.preset ?? base.preset) as PipelineOptions['preset'],
  };
}
