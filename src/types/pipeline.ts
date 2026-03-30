import { ChildProcess } from 'child_process';
import { RunWorkspace } from '../services/workspace-manager.js';

/**
 * Quality preset — predefined CLI flag combinations for zero-steer usage.
 */
export type QualityPreset = 'max-quality' | 'fast';

/**
 * Options parsed from /research command flags.
 */
export interface PipelineOptions {
  /** Research hypothesis / task description. */
  task: string;
  /** Quality preset. */
  preset: QualityPreset;
  /** LLM model override. */
  model: string;
  /** Budget cap in USD. */
  budgetUsd: number;
  /** Output format. */
  outputFormat: 'latex' | 'markdown';
  /** Deployment mode. */
  mode: 'local' | 'tinker' | 'hpc';
  /** Enable theory track (math agents). */
  enableMathAgents: boolean;
  /** Enable multi-model counsel debate. */
  enableCounsel: boolean;
  /** Enable tree search for proofs. */
  enableTreeSearch: boolean;
  /** Custom author style guide path. */
  styleGuidePath?: string;
  /** Resume from prior workspace. */
  resumePath?: string;
  /** Validate without API calls. */
  dryRun: boolean;
  /** Minimum reviewer score to pass validation gate. */
  minReviewScore: number;
  /** Max writeup revision loops. */
  followupMaxIterations: number;
  /** Persona debate rounds. */
  personaDebateRounds: number;
  /** Counsel debate rounds. */
  counselMaxDebateRounds: number;
  /** Require PDF compilation. */
  requirePdf: boolean;
  /** Enforce paper artifact checks. */
  enforcePaperArtifacts: boolean;
  /** Enforce editorial artifact checks. */
  enforceEditorialArtifacts: boolean;
  /** Skip the file upload prompt before pipeline launch. */
  skipUploadPrompt?: boolean;
  /** Local file paths to attach (--attach flag, repeatable). */
  attachFiles?: string[];
  /** Resolved paths of uploaded/attached files in the workspace. */
  uploadedFilePaths?: string[];
}

/**
 * Status of a running or completed pipeline run.
 */
export type RunStatus =
  | 'installing'
  | 'starting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'stopped';

/**
 * Handle to a running pipeline subprocess.
 */
export interface RunHandle {
  /** Unique run identifier (UUID). */
  id: string;
  /** Node child process. */
  process: ChildProcess;
  /** Run workspace directory (set immediately, before spawn). */
  workspaceDir: string;
  /** Structured workspace paths (initial_context, logs, uploads, etc.). */
  workspace?: RunWorkspace;
  /** Root of consortium installation. */
  consortiumDir: string;
  /** HTTP steering port (callback_port + 1). */
  steeringPort: number;
  /** When the run started. */
  startedAt: Date;
  /** Current status. */
  status: RunStatus;
  /** Last detected pipeline stage. */
  currentStage: string;
  /** Last polled budget usage in USD. */
  budgetUsed: number;
  /** Budget limit in USD. */
  budgetLimit: number;
  /** The original task/hypothesis. */
  task: string;
  /** Model used. */
  model: string;
  /** Whether narrative voice has been injected. */
  narrativeVoiceInjected: boolean;
  /** Accumulated stdout lines for parsing. */
  stdoutBuffer: string[];
  /** Accumulated stderr lines. */
  stderrBuffer: string[];
}

/**
 * Stage transition event emitted by the progress poller.
 */
export interface StageEvent {
  /** Run ID. */
  runId: string;
  /** Stage name. */
  stage: string;
  /** Human-friendly stage display name. */
  displayName: string;
  /** Stage index (1-based). */
  stageIndex: number;
  /** Total stages in pipeline. */
  totalStages: number;
  /** Current budget usage. */
  budgetUsed: number;
  /** Budget limit. */
  budgetLimit: number;
  /** Elapsed time in seconds. */
  elapsedSeconds: number;
}

/**
 * Summary of a completed run, read from run_summary.json.
 */
export interface RunSummary {
  task: string;
  model: string;
  durationSeconds: number;
  stagesCompleted: number;
  totalCostUsd: number;
  totalTokens: number;
  finalPaperPath?: string;
  reviewScore?: number;
  aiVoiceRisk?: string;
  workspaceDir: string;
  completedAt: string;
}

/**
 * Record of a past run for /research-list.
 */
export interface RunRecord {
  id: string;
  task: string;
  model: string;
  status: RunStatus;
  costUsd: number;
  durationSeconds: number;
  workspaceDir: string;
  startedAt: string;
  completedAt?: string;
  reviewScore?: number;
}
