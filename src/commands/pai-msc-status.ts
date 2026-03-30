/**
 * /pai-msc-status — show current pipeline run status.
 */
import { activeRuns } from '../index.js';
import { readBudgetState } from '../bridge/result-reader.js';
import { getStageDisplay, getStageIndex, PIPELINE_STAGES } from '../defaults/stage-names.js';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function registerResearchStatusCommand(api: any): void {
  api.registerCommand({
    name: 'pai-msc-status',
    description: 'Show the status of the current research pipeline run.',
    usage: '/pai-msc-status [run-id]',

    handler(args: string) {
      const runId = args?.trim();

      if (activeRuns.size === 0) {
        api.sendMessage('No active research runs. Start one with `/pai-msc "your hypothesis"`.');
        return;
      }

      // Find the requested run or show the most recent
      let run;
      if (runId) {
        run = activeRuns.get(runId);
        if (!run) {
          api.sendMessage(`Run \`${runId}\` not found. Active runs: ${Array.from(activeRuns.keys()).join(', ')}`);
          return;
        }
      } else {
        // Most recent active run
        run = Array.from(activeRuns.values()).pop()!;
      }

      const elapsed = (Date.now() - run.startedAt.getTime()) / 1000;
      const stageIndex = getStageIndex(run.currentStage);
      const stageDisplay = getStageDisplay(run.currentStage);

      // Read budget from workspace if available
      let budgetInfo = '';
      if (run.workspaceDir) {
        const budget = readBudgetState(run.workspaceDir);
        if (budget) {
          run.budgetUsed = budget.total_usd;
          const pct = ((budget.total_usd / budget.usd_limit) * 100).toFixed(0);
          budgetInfo = `$${budget.total_usd.toFixed(2)} / $${budget.usd_limit.toFixed(2)} (${pct}%)`;
        }
      }

      const statusEmoji: Record<string, string> = {
        installing: '...',
        starting: '...',
        running: '>>',
        completed: 'OK',
        failed: '!!',
        stopped: '--',
      };

      const lines = [
        `**Research Status** [${statusEmoji[run.status] ?? '??'}] ${run.status.toUpperCase()}`,
        '',
        `**Run:** ${run.id}`,
        `**Task:** ${run.task.slice(0, 100)}${run.task.length > 100 ? '...' : ''}`,
        `**Model:** ${run.model}`,
        `**Elapsed:** ${formatDuration(elapsed)}`,
      ];

      if (budgetInfo) {
        lines.push(`**Budget:** ${budgetInfo}`);
      }

      if (run.currentStage) {
        const progress = stageIndex > 0
          ? ` (${stageIndex}/${PIPELINE_STAGES.length})`
          : '';
        lines.push(`**Current Stage:** ${stageDisplay}${progress}`);
      }

      if (run.workspaceDir) {
        lines.push(`**Workspace:** \`${run.workspaceDir}\``);
      }

      api.sendMessage(lines.join('\n'));
    },
  });
}
