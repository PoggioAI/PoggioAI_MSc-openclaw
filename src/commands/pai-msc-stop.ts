/**
 * /pai-msc-stop — stop a running pipeline.
 */
import { activeRuns } from '../index.js';
import { stopPipeline } from '../services/process-manager.js';
import { composeCompletionMessage } from '../bridge/result-reader.js';

export function registerResearchStopCommand(api: any): void {
  api.registerCommand({
    name: 'pai-msc-stop',
    description: 'Stop a running research pipeline.',
    usage: '/pai-msc-stop [run-id]',

    handler(args: string) {
      const runId = args?.trim();

      if (activeRuns.size === 0) {
        api.sendMessage('No active research runs to stop.');
        return;
      }

      let run;
      if (runId) {
        run = activeRuns.get(runId);
        if (!run) {
          api.sendMessage(
            `Run \`${runId}\` not found. Active runs: ${Array.from(activeRuns.keys()).join(', ')}`,
          );
          return;
        }
      } else {
        run = Array.from(activeRuns.values()).pop()!;
      }

      if (run.status !== 'running' && run.status !== 'starting') {
        api.sendMessage(`Run \`${run.id}\` is already ${run.status}.`);
        return;
      }

      stopPipeline(run);
      api.sendMessage(composeCompletionMessage(run));

      // Keep in activeRuns for a while so status can be checked
      setTimeout(() => {
        activeRuns.delete(run.id);
      }, 60_000);
    },
  });
}
