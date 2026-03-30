/**
 * /research-list — list past and active research runs.
 */
import { activeRuns, runHistory } from '../index.js';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function registerResearchListCommand(api: any): void {
  api.registerCommand({
    name: 'research-list',
    description: 'List all research runs in this session.',
    usage: '/research-list',

    handler() {
      if (runHistory.length === 0) {
        api.sendMessage(
          'No research runs yet. Start one with `/research "your hypothesis"`.',
        );
        return;
      }

      const lines: string[] = ['**Research Runs**', ''];

      for (const run of runHistory) {
        const elapsed = (
          (run.status === 'running' || run.status === 'starting'
            ? Date.now()
            : run.startedAt.getTime()) - run.startedAt.getTime()
        ) / 1000;

        const statusIcon: Record<string, string> = {
          installing: '...',
          starting: '...',
          running: '>>',
          completed: 'OK',
          failed: '!!',
          stopped: '--',
        };

        const isActive = activeRuns.has(run.id);

        lines.push(
          `[${statusIcon[run.status] ?? '??'}] **${run.id}**${isActive ? ' (active)' : ''}`,
        );
        lines.push(
          `    ${run.task.slice(0, 80)}${run.task.length > 80 ? '...' : ''}`,
        );
        lines.push(
          `    ${run.model} | $${run.budgetUsed.toFixed(2)} | ${formatDuration(elapsed)} | ${run.status}`,
        );
        lines.push('');
      }

      api.sendMessage(lines.join('\n'));
    },
  });
}
