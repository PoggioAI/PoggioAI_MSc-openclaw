/**
 * consortium.approveMilestone — respond to a human-in-the-loop gate.
 *
 * When the pipeline pauses at a milestone (e.g., after research plan),
 * this tool approves, modifies, or aborts the milestone.
 */
import { activeRuns } from '../index.js';
import { SteeringClient } from '../bridge/steering-client.js';

export function registerApproveMilestoneTool(api: any): void {
  api.registerTool({
    name: 'consortium.approveMilestone',
    description:
      'Respond to a pipeline milestone gate. Use "approve" to continue, ' +
      '"modify" with feedback to adjust, or "abort" to stop the pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        runId: {
          type: 'string',
          description: 'The run ID.',
        },
        action: {
          type: 'string',
          enum: ['approve', 'modify', 'abort'],
          description: 'The action to take at the milestone.',
        },
        feedback: {
          type: 'string',
          description: 'Feedback text (required for "modify" action).',
        },
      },
      required: ['runId', 'action'],
    },

    async handler(input: any) {
      const run = activeRuns.get(input.runId);
      if (!run) {
        return { error: `Run ${input.runId} not found.` };
      }

      const steering = new SteeringClient(run.steeringPort);

      const ready = await steering.waitForReady(10000);
      if (!ready) {
        return { error: 'Steering server not reachable.' };
      }

      try {
        await steering.respondToMilestone(input.action, input.feedback);
        return {
          success: true,
          action: input.action,
          message: `Milestone ${input.action}d for run ${input.runId}.`,
        };
      } catch (err: any) {
        return { error: `Milestone response failed: ${err.message}` };
      }
    },
  });
}
