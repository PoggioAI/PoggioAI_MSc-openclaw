/**
 * pai-msc.steerPipeline — inject instructions into a running pipeline.
 */
import { activeRuns } from '../index.js';
import { SteeringClient } from '../bridge/steering-client.js';

export function registerSteerPipelineTool(api: any): void {
  api.registerTool({
    name: 'pai-msc.steerPipeline',
    description:
      'Inject a steering instruction into a running research pipeline. ' +
      'Can be used to redirect research focus, provide additional context, ' +
      'or modify the approach mid-run.',
    inputSchema: {
      type: 'object',
      properties: {
        runId: {
          type: 'string',
          description: 'The run ID to steer.',
        },
        instruction: {
          type: 'string',
          description: 'The instruction to inject into the pipeline.',
        },
        pause: {
          type: 'boolean',
          description: 'Whether to pause the pipeline before injecting. Default: false.',
        },
      },
      required: ['runId', 'instruction'],
    },

    async handler(input: any) {
      const run = activeRuns.get(input.runId);
      if (!run) {
        return { error: `Run ${input.runId} not found. Active runs: ${Array.from(activeRuns.keys()).join(', ')}` };
      }

      if (run.status !== 'running') {
        return { error: `Run ${input.runId} is ${run.status}, not running.` };
      }

      const steering = new SteeringClient(run.steeringPort);

      const ready = await steering.waitForReady(10000);
      if (!ready) {
        return { error: 'Steering server not reachable. The pipeline may not have started its HTTP server yet.' };
      }

      try {
        if (input.pause) {
          await steering.pause();
        }

        await steering.inject(input.instruction, 'm');

        return {
          success: true,
          runId: input.runId,
          currentStage: run.currentStage,
          message: `Instruction injected into run ${input.runId} at stage ${run.currentStage}.`,
        };
      } catch (err: any) {
        return { error: `Steering failed: ${err.message}` };
      }
    },
  });
}
