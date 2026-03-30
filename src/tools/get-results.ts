/**
 * consortium.getResults — retrieve results from a completed or running pipeline.
 */
import { activeRuns, runHistory } from '../index.js';
import {
  readRunSummary,
  readBudgetState,
  readReviewVerdict,
  findPaperFile,
  listArtifacts,
} from '../bridge/result-reader.js';
import { getStageDisplay } from '../defaults/stage-names.js';

export function registerGetResultsTool(api: any): void {
  api.registerTool({
    name: 'consortium.getResults',
    description:
      'Get the status and results of a research pipeline run. ' +
      'Returns the current stage, budget, review score, and paper path.',
    inputSchema: {
      type: 'object',
      properties: {
        runId: {
          type: 'string',
          description: 'The run ID to check. If omitted, returns the most recent run.',
        },
      },
    },

    handler(input: any) {
      let run;
      if (input?.runId) {
        run = activeRuns.get(input.runId) ?? runHistory.find((r: any) => r.id === input.runId);
      } else {
        run = Array.from(activeRuns.values()).pop() ?? runHistory[runHistory.length - 1];
      }

      if (!run) {
        return { error: 'No runs found. Start one with consortium.runPipeline or /research.' };
      }

      const result: any = {
        runId: run.id,
        status: run.status,
        task: run.task,
        model: run.model,
        currentStage: run.currentStage,
        currentStageDisplay: getStageDisplay(run.currentStage),
        startedAt: run.startedAt.toISOString(),
        elapsedSeconds: Math.round((Date.now() - run.startedAt.getTime()) / 1000),
        workspaceDir: run.workspaceDir,
      };

      if (run.workspaceDir) {
        // Budget
        const budget = readBudgetState(run.workspaceDir);
        if (budget) {
          result.budget = {
            used: budget.total_usd,
            limit: budget.usd_limit,
            percentUsed: Math.round((budget.total_usd / budget.usd_limit) * 100),
            byModel: budget.by_model,
          };
        }

        // Review verdict
        const verdict = readReviewVerdict(run.workspaceDir);
        if (verdict) {
          result.review = {
            score: verdict.score,
            aiVoiceRisk: verdict.ai_voice_risk,
            hardBlockers: verdict.hard_blockers,
            fixType: verdict.fix_type,
            summary: verdict.summary,
          };
        }

        // Paper file
        const paperPath = findPaperFile(run.workspaceDir);
        if (paperPath) {
          result.paperPath = paperPath;
        }

        // Run summary (if completed)
        const summary = readRunSummary(run.workspaceDir);
        if (summary) {
          result.summary = summary;
        }

        // Artifact listing
        result.artifacts = listArtifacts(run.workspaceDir).map((a: any) => ({
          name: a.name,
          sizeKb: Math.round(a.size / 1024),
        }));
      }

      return result;
    },
  });
}
