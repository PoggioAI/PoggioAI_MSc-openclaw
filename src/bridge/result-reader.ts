/**
 * Result Reader — parses workspace outputs after pipeline completion
 * and composes a summary for delivery to the user.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { RunHandle, RunSummary } from '../types/pipeline.js';
import { BudgetState } from '../types/budget.js';
import { ReviewVerdict } from '../types/steering.js';

/**
 * Read the run summary from a completed workspace.
 */
export function readRunSummary(workspaceDir: string): RunSummary | null {
  const summaryPath = path.join(workspaceDir, 'run_summary.json');
  if (!existsSync(summaryPath)) return null;

  try {
    return JSON.parse(readFileSync(summaryPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Read the budget state from a workspace.
 */
export function readBudgetState(workspaceDir: string): BudgetState | null {
  const budgetPath = path.join(workspaceDir, 'budget_state.json');
  if (!existsSync(budgetPath)) return null;

  try {
    return JSON.parse(readFileSync(budgetPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Read the review verdict from a workspace.
 */
export function readReviewVerdict(workspaceDir: string): ReviewVerdict | null {
  const verdictPath = path.join(workspaceDir, 'paper_workspace', 'review_verdict.json');
  if (!existsSync(verdictPath)) return null;

  try {
    return JSON.parse(readFileSync(verdictPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Find the final paper file in the workspace.
 * Priority: PDF > LaTeX > Markdown
 */
export function findPaperFile(workspaceDir: string): string | null {
  const paperWorkspace = path.join(workspaceDir, 'paper_workspace');
  const candidates = [
    path.join(paperWorkspace, 'final_paper.pdf'),
    path.join(paperWorkspace, 'final_paper.tex'),
    path.join(paperWorkspace, 'final_paper.md'),
    // Fallback: look in root workspace
    path.join(workspaceDir, 'final_paper.pdf'),
    path.join(workspaceDir, 'final_paper.tex'),
    path.join(workspaceDir, 'final_paper.md'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

/**
 * Get a list of all artifacts in the workspace with sizes.
 */
export function listArtifacts(
  workspaceDir: string,
): Array<{ name: string; size: number; path: string }> {
  const artifacts: Array<{ name: string; size: number; path: string }> = [];

  const dirs = [
    'initial_context', 'initial_context/uploads', 'initial_context/prompts',
    'paper_workspace', 'math_workspace', 'experiment_workspace', 'logs',
    // Cycle archives and human review folders
    'cycle_0', 'cycle_1', 'cycle_2',
    'review_1', 'review_2', 'review_3',
  ];

  for (const dir of dirs) {
    const dirPath = path.join(workspaceDir, dir);
    if (!existsSync(dirPath)) continue;

    try {
      const files = readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        try {
          const stat = statSync(filePath);
          if (stat.isFile()) {
            artifacts.push({
              name: `${dir}/${file}`,
              size: stat.size,
              path: filePath,
            });
          }
        } catch {
          // Skip files we can't stat
        }
      }
    } catch {
      // Skip dirs we can't read
    }
  }

  return artifacts;
}

/**
 * Format duration in seconds to human-readable string.
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Compose a completion summary message for the user.
 */
export function composeCompletionMessage(run: RunHandle): string {
  const budget = readBudgetState(run.workspaceDir);
  const verdict = readReviewVerdict(run.workspaceDir);
  const paperFile = findPaperFile(run.workspaceDir);
  const elapsed = (Date.now() - run.startedAt.getTime()) / 1000;

  const lines: string[] = [];

  if (run.status === 'completed') {
    lines.push('**Research Complete!**');
  } else if (run.status === 'failed') {
    lines.push('**Research Pipeline Failed**');
  } else if (run.status === 'stopped') {
    lines.push('**Research Pipeline Stopped**');
  }

  lines.push('');

  // Task (truncated)
  const taskPreview = run.task.length > 100
    ? run.task.slice(0, 100) + '...'
    : run.task;
  lines.push(`**Task:** ${taskPreview}`);

  // Model & Duration
  lines.push(`**Model:** ${run.model} | **Duration:** ${formatDuration(elapsed)}`);

  // Cost
  if (budget) {
    lines.push(`**Cost:** $${budget.total_usd.toFixed(2)} / $${budget.usd_limit.toFixed(2)}`);

    // Per-model breakdown if interesting
    const models = Object.entries(budget.by_model)
      .filter(([_, cost]) => (cost as number) > 0.01)
      .sort(([, a], [, b]) => (b as number) - (a as number));
    if (models.length > 1) {
      const breakdown = models
        .map(([model, cost]) => `${model}: $${(cost as number).toFixed(2)}`)
        .join(', ');
      lines.push(`**Breakdown:** ${breakdown}`);
    }
  }

  // Review verdict
  if (verdict) {
    lines.push(`**Review Score:** ${verdict.score}/10 | **AI Voice Risk:** ${verdict.ai_voice_risk}`);
    if (verdict.hard_blockers.length > 0) {
      lines.push(`**Hard Blockers:** ${verdict.hard_blockers.join(', ')}`);
    }
  }

  // Paper file
  if (paperFile) {
    lines.push('');
    const ext = path.extname(paperFile).toUpperCase().replace('.', '');
    lines.push(`**Paper (${ext}):** \`${paperFile}\``);
  }

  // Workspace
  lines.push(`**Workspace:** \`${run.workspaceDir}\``);

  // Resume hint on failure
  if (run.status === 'failed') {
    lines.push('');
    lines.push(`Resume with: \`/pai-msc --resume "${run.workspaceDir}" "${run.task}"\``);
  }

  return lines.join('\n');
}

/**
 * Compose a failure message with relevant error context.
 */
export function composeFailureMessage(run: RunHandle): string {
  const lines: string[] = [
    '**Pipeline Failed**',
    '',
    `**Task:** ${run.task.slice(0, 100)}`,
    `**Stage:** ${run.currentStage || 'unknown'}`,
    `**Duration:** ${formatDuration((Date.now() - run.startedAt.getTime()) / 1000)}`,
  ];

  // Include last few stderr lines
  const recentErrors = run.stderrBuffer.slice(-5);
  if (recentErrors.length > 0) {
    lines.push('');
    lines.push('**Last errors:**');
    lines.push('```');
    lines.push(...recentErrors);
    lines.push('```');
  }

  lines.push('');
  lines.push(`Resume: \`/pai-msc --resume "${run.workspaceDir}" "${run.task}"\``);

  return lines.join('\n');
}
