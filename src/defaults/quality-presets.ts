import { PipelineOptions } from '../types/pipeline.js';

/**
 * Quality presets — predefined configurations that maximize paper quality
 * with zero user tuning. These are the result of extensive backtesting
 * against the Claude skill orchestrator (SKILL.md).
 *
 * QUALITY_MAX: Best possible paper. Everything turned to 11.
 * Uses Opus, counsel, math agents, tree search, strict review gates,
 * 5-round persona debate, 12-pass writeup, 2 ideation cycles.
 * Matches the Claude skill's multi-pass execution protocol exactly.
 * Cost: ~$100-300 | Time: 3-8 hours
 *
 * QUALITY_FAST: Quick draft. Uses Sonnet, no counsel, no math,
 * relaxed gates, markdown output.
 * Cost: ~$5-15 | Time: 20-60 minutes
 */

type PresetDefaults = Omit<PipelineOptions, 'task' | 'styleGuidePath' | 'resumePath'>;

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
  dryRun: false,

  // Review gates: maximum strictness
  minReviewScore: 7,
  requirePdf: true,
  enforcePaperArtifacts: true,
  enforceEditorialArtifacts: true,

  // Iterations: match SKILL.md multi-pass protocol
  // SKILL.md: 3-5 persona debate rounds, 12 writeup passes, 2 ideation cycles
  followupMaxIterations: 5,
  personaDebateRounds: 5,
  counselMaxDebateRounds: 5,
  writeupPasses: 12,
  minPassesPerPhase: 2,
  maxIdeationCycles: 2,
  preWriteupDebateRounds: 2,
  postReviewDebateRounds: 2,
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
