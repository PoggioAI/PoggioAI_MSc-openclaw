import { PipelineOptions } from '../types/pipeline.js';

/**
 * Quality presets — predefined configurations that maximize paper quality
 * with zero user tuning. These are the result of extensive backtesting.
 *
 * QUALITY_MAX: Best possible paper. Uses Opus, counsel, math agents,
 * strict review gates, 3-round persona debate, 12-pass writeup.
 * Cost: ~$50-200 | Time: 2-5 hours
 *
 * QUALITY_FAST: Quick draft. Uses Sonnet, no counsel, no math,
 * relaxed gates, markdown output.
 * Cost: ~$5-15 | Time: 20-60 minutes
 */

type PresetDefaults = Omit<PipelineOptions, 'task' | 'styleGuidePath' | 'resumePath'>;

export const QUALITY_MAX: PresetDefaults = {
  preset: 'max-quality',
  model: 'claude-opus-4-6',
  budgetUsd: 150,
  outputFormat: 'latex',
  mode: 'local',

  // Quality features: all on
  enableMathAgents: true,
  enableCounsel: true,
  enableTreeSearch: false, // Expensive; enable explicitly if needed
  dryRun: false,

  // Review gates: strict
  minReviewScore: 6,
  requirePdf: true,
  enforcePaperArtifacts: true,
  enforceEditorialArtifacts: true,

  // Iterations: generous
  followupMaxIterations: 3,
  personaDebateRounds: 3,
  counselMaxDebateRounds: 3,
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
