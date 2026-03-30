/**
 * Process Manager — spawns and monitors the consortium Python subprocess.
 *
 * Handles:
 * - Building the CLI argument array from PipelineOptions
 * - Spawning the Python process via conda/venv
 * - Parsing stdout for stage transitions and completion
 * - Tracking process lifecycle (starting -> running -> completed/failed)
 * - Logging stdout/stderr to files in the run workspace
 *
 * The workspace is now created BEFORE spawn (by workspace-manager.ts),
 * so workspaceDir is known immediately — no stdout parsing needed for it.
 */
import { spawn, ChildProcess } from 'child_process';
import { existsSync, readFileSync, createWriteStream } from 'fs';
import path from 'path';
import { PipelineOptions, RunHandle, RunStatus } from '../types/pipeline.js';
import { PluginConfig } from '../types/config.js';
import { RunWorkspace } from './workspace-manager.js';
import { buildSubprocessEnv } from '../bridge/env-passthrough.js';
import { PIPELINE_STAGES } from '../defaults/stage-names.js';

/**
 * Generate a unique run ID.
 */
function generateRunId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const rand = Math.random().toString(36).slice(2, 6);
  return `run-${ts}-${rand}`;
}

/**
 * Determine the Python execution prefix based on installation method.
 */
function getPythonPrefix(consortiumDir: string, config: PluginConfig): string[] {
  const sentinelPath = path.join(consortiumDir, '.installed');
  if (existsSync(sentinelPath)) {
    try {
      const sentinel = JSON.parse(readFileSync(sentinelPath, 'utf-8'));
      if (sentinel.condaEnv) {
        return ['conda', 'run', '-n', sentinel.condaEnv, '--no-banner', '--no-capture-output', 'python'];
      }
      if (sentinel.venvPath) {
        return [path.join(sentinel.venvPath, 'bin', 'python')];
      }
    } catch {
      // Fall through to default
    }
  }

  // Fallback: try conda with config env name
  return ['conda', 'run', '-n', config.condaEnvName, '--no-banner', '--no-capture-output', 'python'];
}

/**
 * Build the CLI arguments array from PipelineOptions.
 *
 * Always passes --resume pointing to the pre-created workspace directory,
 * so the consortium uses our workspace as its results_base_dir.
 */
function buildCliArgs(
  options: PipelineOptions,
  callbackPort: number,
  workspaceDir: string,
): string[] {
  const args: string[] = [
    'launch_multiagent.py',
    '--task', options.task,
    '--model', options.model,
    '--mode', options.mode,
    '--output-format', options.outputFormat,
    '--min-review-score', String(options.minReviewScore),
    '--followup-max-iterations', String(options.followupMaxIterations),
    '--callback_port', String(callbackPort),
    '--autonomous-mode',
    // Always pass --resume so the consortium uses our pre-created workspace
    '--resume', workspaceDir,
  ];

  if (options.enableMathAgents) args.push('--enable-math-agents');
  if (options.enableCounsel) args.push('--enable-counsel');
  if (options.enableTreeSearch) args.push('--enable-tree-search');
  if (options.requirePdf) args.push('--require-pdf');
  if (options.enforcePaperArtifacts) args.push('--enforce-paper-artifacts');
  if (options.enforceEditorialArtifacts) args.push('--enforce-editorial-artifacts');
  if (options.dryRun) args.push('--dry-run');

  return args;
}

/** Next available port for callback server. Auto-increments for concurrent runs. */
let nextPort = 5001;

/**
 * Spawn the consortium pipeline subprocess.
 *
 * @param options - Resolved pipeline options.
 * @param workspace - Pre-created run workspace (from workspace-manager).
 * @param consortiumDir - Root of consortium installation.
 * @param config - Plugin configuration.
 * @returns RunHandle with the subprocess and parsed metadata.
 */
export function spawnPipeline(
  options: PipelineOptions,
  workspace: RunWorkspace,
  consortiumDir: string,
  config: PluginConfig,
): RunHandle {
  const callbackPort = config.steeringBasePort + (nextPort - 5001) * 2;
  nextPort++;

  const pythonPrefix = getPythonPrefix(consortiumDir, config);
  const cliArgs = buildCliArgs(options, callbackPort, workspace.runDir);
  const fullCmd = [...pythonPrefix, ...cliArgs];

  // Build per-run subprocess environment
  const subprocessEnv = buildSubprocessEnv(workspace.runDir, workspace.uploadsDir);

  const child: ChildProcess = spawn(fullCmd[0], fullCmd.slice(1), {
    cwd: consortiumDir,
    env: subprocessEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const run: RunHandle = {
    id: generateRunId(),
    process: child,
    workspaceDir: workspace.runDir, // Known immediately — no stdout parsing needed
    workspace,
    consortiumDir,
    steeringPort: callbackPort + 1,
    startedAt: new Date(),
    status: 'starting',
    currentStage: '',
    budgetUsed: 0,
    budgetLimit: options.budgetUsd,
    task: options.task,
    model: options.model,
    narrativeVoiceInjected: false,
    stdoutBuffer: [],
    stderrBuffer: [],
  };

  // Set up log file streams
  const stdoutLog = createWriteStream(path.join(workspace.logsDir, 'stdout.log'), { flags: 'a' });
  const stderrLog = createWriteStream(path.join(workspace.logsDir, 'stderr.log'), { flags: 'a' });

  // Parse stdout for stage transitions and completion
  child.stdout?.on('data', (data: Buffer) => {
    const chunk = data.toString();
    stdoutLog.write(chunk);

    const lines = chunk.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      run.stdoutBuffer.push(line);

      // Mark as running once we see any meaningful output
      if (run.status === 'starting') {
        run.status = 'running';
      }

      // Detect stage transitions
      for (const stage of PIPELINE_STAGES) {
        if (line.includes(stage) && run.currentStage !== stage) {
          run.currentStage = stage;
          break;
        }
      }

      // Detect completion
      if (line.includes('Task finished.')) {
        run.status = 'completed';
      }

      // Detect budget exhaustion
      if (line.includes('BudgetExceededError')) {
        run.status = 'failed';
      }
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    const chunk = data.toString();
    stderrLog.write(chunk);

    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        run.stderrBuffer.push(line);
      }
    }
  });

  child.on('exit', (code) => {
    stdoutLog.end();
    stderrLog.end();
    if (run.status === 'running' || run.status === 'starting') {
      run.status = code === 0 ? 'completed' : 'failed';
    }
  });

  child.on('error', (err) => {
    run.status = 'failed';
    run.stderrBuffer.push(`Process error: ${err.message}`);
    stdoutLog.end();
    stderrLog.end();
  });

  return run;
}

/**
 * Stop a running pipeline gracefully.
 */
export function stopPipeline(run: RunHandle): void {
  if (run.status === 'running' || run.status === 'starting') {
    try {
      run.process.kill('SIGTERM');
      run.status = 'stopped';
    } catch {
      try {
        run.process.kill('SIGKILL');
        run.status = 'stopped';
      } catch {
        // Process already dead
      }
    }
  }
}

/**
 * Get the last N lines of stdout for debugging.
 */
export function getRecentOutput(run: RunHandle, lines: number = 50): string[] {
  return run.stdoutBuffer.slice(-lines);
}

/**
 * Get the last N lines of stderr for debugging.
 */
export function getRecentErrors(run: RunHandle, lines: number = 20): string[] {
  return run.stderrBuffer.slice(-lines);
}
