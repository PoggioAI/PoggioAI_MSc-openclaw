/**
 * pai-msc.runPipeline — agent-callable tool for programmatic pipeline runs.
 *
 * This tool allows the OpenClaw agent to start a research pipeline
 * on behalf of the user, e.g., when the user says "research X for me".
 *
 * Uses the workspace-first architecture: creates the run directory,
 * injects quality artifacts, then spawns with --resume.
 */
import { activeRuns, runHistory, getConfig, getConsortiumDir } from '../index.js';
import { resolveOptions } from '../defaults/quality-presets.js';
import { isInstalled, install, checkPrereqs } from '../services/installer.js';
import { writeEnvFile } from '../bridge/env-passthrough.js';
import { writeConfig } from '../bridge/config-writer.js';
import { injectToInitialContext } from '../services/quality-injector.js';
import { createRunWorkspace, writeTaskFile, writePipelineOptions, copyFilesToUploads } from '../services/workspace-manager.js';
import { spawnPipeline } from '../services/process-manager.js';

export function registerRunPipelineTool(api: any): void {
  api.registerTool({
    name: 'pai-msc.runPipeline',
    description:
      'Start the pAI/MSc-openclaw research pipeline with a hypothesis. ' +
      'Returns a run ID for tracking. The pipeline runs autonomously ' +
      'and produces a conference-grade manuscript. All inputs are saved ' +
      'to initial_context/ in the run workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'The research hypothesis or task description.',
        },
        preset: {
          type: 'string',
          enum: ['max-quality', 'fast'],
          description: 'Quality preset. Default: max-quality.',
        },
        model: {
          type: 'string',
          description: 'LLM model override (e.g., claude-opus-4-6).',
        },
        budgetUsd: {
          type: 'number',
          description: 'Budget cap in USD.',
        },
        outputFormat: {
          type: 'string',
          enum: ['latex', 'markdown'],
          description: 'Output format.',
        },
        enableMathAgents: {
          type: 'boolean',
          description: 'Enable theory track (math agents).',
        },
        enableCounsel: {
          type: 'boolean',
          description: 'Enable multi-model counsel debate.',
        },
        attachFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Local file paths to attach as reference material.',
        },
      },
      required: ['task'],
    },

    async handler(input: any) {
      const config = getConfig(api);
      const consortiumDir = getConsortiumDir(config);
      const pluginDir = __dirname.replace(/\/src\/tools$/, '').replace(/\/dist\/tools$/, '');

      // Check prerequisites
      const errors = checkPrereqs();
      if (errors.length > 0) {
        return { error: errors.join('; ') };
      }

      // Auto-install if needed
      if (!isInstalled(consortiumDir)) {
        try {
          await install(consortiumDir, config, pluginDir, () => {});
        } catch (err: any) {
          return { error: `Installation failed: ${err.message}` };
        }
      }

      // Resolve options
      const options = resolveOptions(input.task, input.preset ?? 'max-quality', {
        model: input.model,
        budgetUsd: input.budgetUsd,
        outputFormat: input.outputFormat,
        enableMathAgents: input.enableMathAgents,
        enableCounsel: input.enableCounsel,
      });

      // Create run workspace
      const now = new Date();
      const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const rand = Math.random().toString(36).slice(2, 6);
      const runId = `run-${ts}-${rand}`;

      const workspace = createRunWorkspace(runId);

      // Inject quality artifacts to initial_context/ (no polling)
      try {
        injectToInitialContext(workspace, options);
      } catch { /* non-fatal */ }

      // Write task and options snapshots
      writeTaskFile(workspace, options.task);
      writePipelineOptions(workspace, options);

      // Handle attached files
      if (input.attachFiles && input.attachFiles.length > 0) {
        const saved = copyFilesToUploads(workspace, input.attachFiles);
        if (saved.length > 0) {
          options.uploadedFilePaths = saved;
          const fileList = saved.map((f: string) => {
            const path = require('path');
            return path.basename(f);
          }).join(', ');
          options.task += `\n\n[Reference files provided: ${fileList}. ` +
            `They are available at: ${workspace.uploadsDir}]`;
        }
      }

      // Write env + config
      try {
        writeEnvFile(workspace.runDir);
      } catch (err: any) {
        return { error: err.message };
      }

      writeConfig(workspace.runDir, options, consortiumDir);

      // Spawn pipeline with workspace
      const run = spawnPipeline(options, workspace, consortiumDir, config);
      activeRuns.set(run.id, run);
      runHistory.push(run);

      return {
        runId: run.id,
        status: 'started',
        task: input.task,
        model: options.model,
        budget: options.budgetUsd,
        workspaceDir: workspace.runDir,
        attachedFiles: options.uploadedFilePaths?.length ?? 0,
        message: `Research pipeline started. Use pai-msc.getResults with runId "${run.id}" to check status.`,
      };
    },
  });
}
