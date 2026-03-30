/**
 * Workspace Manager — creates and manages per-run directory structures.
 *
 * Each pipeline run gets its own isolated directory under
 * ~/.openclaw/poggioai-msc/runs/{run-id}/ with:
 *
 *   initial_context/          — all inputs (task, prompts, style guide, uploads)
 *     prompts/                — 25 backtested agent prompts
 *     uploads/                — user-uploaded reference files
 *   logs/                     — captured stdout/stderr
 *   paper_workspace/          — created by consortium at runtime
 *   math_workspace/           — if math agents enabled
 *   experiment_workspace/     — if experiments run
 *
 * The plugin creates this directory BEFORE spawning the consortium subprocess
 * and passes it via --resume, so workspaceDir is known immediately.
 */
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { PipelineOptions } from '../types/pipeline.js';

/**
 * Structured paths within a run workspace.
 */
export interface RunWorkspace {
  /** Root of the run directory (e.g., ~/.openclaw/poggioai-msc/runs/run-2026-03-29T15-30-22-a1b2). */
  runDir: string;
  /** initial_context/ — everything that goes into the pipeline. */
  initialContextDir: string;
  /** initial_context/prompts/ — 25 backtested prompt files. */
  promptsDir: string;
  /** initial_context/uploads/ — user-uploaded reference files. */
  uploadsDir: string;
  /** logs/ — stdout.log and stderr.log. */
  logsDir: string;
}

/**
 * Get the base directory for all plugin runs.
 */
export function getRunsBaseDir(): string {
  return path.join(os.homedir(), '.openclaw', 'poggioai-msc', 'runs');
}

/**
 * Create the full run workspace directory tree.
 *
 * @param runId - Unique run identifier (e.g., 'run-2026-03-29T15-30-22-a1b2')
 * @returns Structured workspace paths.
 */
export function createRunWorkspace(runId: string): RunWorkspace {
  const runsBase = getRunsBaseDir();
  const runDir = path.join(runsBase, runId);

  const workspace: RunWorkspace = {
    runDir,
    initialContextDir: path.join(runDir, 'initial_context'),
    promptsDir: path.join(runDir, 'initial_context', 'prompts'),
    uploadsDir: path.join(runDir, 'initial_context', 'uploads'),
    logsDir: path.join(runDir, 'logs'),
  };

  // Create all directories
  mkdirSync(workspace.promptsDir, { recursive: true });
  mkdirSync(workspace.uploadsDir, { recursive: true });
  mkdirSync(workspace.logsDir, { recursive: true });

  // Also create paper_workspace/ so the consortium finds it
  mkdirSync(path.join(runDir, 'paper_workspace'), { recursive: true });

  return workspace;
}

/**
 * Write the research task/hypothesis to initial_context/task.txt.
 */
export function writeTaskFile(workspace: RunWorkspace, task: string): void {
  writeFileSync(
    path.join(workspace.initialContextDir, 'task.txt'),
    task,
    'utf-8',
  );
}

/**
 * Write the resolved pipeline options to initial_context/pipeline_options.json.
 * This creates a full snapshot of the options used for this run.
 */
export function writePipelineOptions(
  workspace: RunWorkspace,
  options: PipelineOptions,
): void {
  const snapshot = {
    ...options,
    _generatedAt: new Date().toISOString(),
    _pluginVersion: '0.1.0',
  };
  writeFileSync(
    path.join(workspace.initialContextDir, 'pipeline_options.json'),
    JSON.stringify(snapshot, null, 2),
    'utf-8',
  );
}

/**
 * Copy local files into initial_context/uploads/.
 *
 * @param workspace - The run workspace.
 * @param filePaths - Absolute paths to files to copy.
 * @returns Array of destination paths (inside the workspace).
 */
export function copyFilesToUploads(
  workspace: RunWorkspace,
  filePaths: string[],
): string[] {
  const savedPaths: string[] = [];

  for (const srcPath of filePaths) {
    if (!existsSync(srcPath)) {
      continue; // Skip missing files silently
    }

    const filename = path.basename(srcPath);
    let destPath = path.join(workspace.uploadsDir, filename);

    // Handle name collisions by appending a counter
    if (existsSync(destPath)) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      let counter = 1;
      while (existsSync(destPath)) {
        destPath = path.join(workspace.uploadsDir, `${base}_${counter}${ext}`);
        counter++;
      }
    }

    copyFileSync(srcPath, destPath);
    savedPaths.push(destPath);
  }

  return savedPaths;
}

/**
 * Write arbitrary data to a file in initial_context/uploads/.
 * Used for saving file attachments received from user messages.
 *
 * @returns The saved file path.
 */
export function saveUploadData(
  workspace: RunWorkspace,
  filename: string,
  data: Buffer,
): string {
  let destPath = path.join(workspace.uploadsDir, filename);

  // Handle name collisions
  if (existsSync(destPath)) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    let counter = 1;
    while (existsSync(destPath)) {
      destPath = path.join(workspace.uploadsDir, `${base}_${counter}${ext}`);
      counter++;
    }
  }

  writeFileSync(destPath, data);
  return destPath;
}

/**
 * List all run directories, sorted by creation time (newest first).
 */
export function listRunDirs(): string[] {
  const runsBase = getRunsBaseDir();
  if (!existsSync(runsBase)) return [];

  const { readdirSync, statSync } = require('fs');
  const dirs = readdirSync(runsBase)
    .filter((name: string) => {
      const fullPath = path.join(runsBase, name);
      try {
        return statSync(fullPath).isDirectory() && name.startsWith('run-');
      } catch {
        return false;
      }
    })
    .sort()
    .reverse();

  return dirs.map((name: string) => path.join(runsBase, name));
}
