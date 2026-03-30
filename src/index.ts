/**
 * pAI/MSc-openclaw Plugin — Entry Point
 *
 * Registers commands, tools, services, and hooks with the OpenClaw gateway.
 * This plugin wraps the pAI/MSc-openclaw consortium research pipeline,
 * providing zero-config access via /pai-msc "hypothesis".
 */
import { definePluginEntry } from 'openclaw/plugin-sdk/core';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';
import { registerResearchCommand } from './commands/research.js';
import { registerResearchStatusCommand } from './commands/pai-msc-status.js';
import { registerResearchStopCommand } from './commands/pai-msc-stop.js';
import { registerResearchListCommand } from './commands/pai-msc-list.js';
import { registerRunPipelineTool } from './tools/run-pipeline.js';
import { registerSteerPipelineTool } from './tools/steer-pipeline.js';
import { registerGetResultsTool } from './tools/get-results.js';
import { registerApproveMilestoneTool } from './tools/approve-milestone.js';
import { registerProgressPoller } from './services/progress-poller.js';
import { PluginConfig, DEFAULT_CONFIG } from './types/config.js';
import { RunHandle } from './types/pipeline.js';

/**
 * Global registry of active and past runs.
 * Shared across commands, tools, and services.
 */
export const activeRuns = new Map<string, RunHandle>();
export const runHistory: RunHandle[] = [];

/**
 * Get the resolved plugin config, merging user overrides with defaults.
 */
export function getConfig(api: any): PluginConfig {
  const userConfig = api.getConfig?.() ?? {};
  return { ...DEFAULT_CONFIG, ...userConfig };
}

/**
 * Resolve the consortium installation directory.
 */
export function getConsortiumDir(config: PluginConfig): string {
  if (config.consortiumPath) {
    return config.consortiumPath;
  }
  const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
  return `${homeDir}/.openclaw/poggioai-msc/repo`;
}

export default definePluginEntry({
  id: 'pai-msc-openclaw',
  name: 'pAI/MSc-openclaw',
  description:
    'Autonomous multi-agent research pipeline: hypothesis to conference-grade manuscript in one command.',
  register(api: OpenClawPluginApi) {
    // --- Commands (user-facing slash commands) ---
    registerResearchCommand(api);
    registerResearchStatusCommand(api);
    registerResearchStopCommand(api);
    registerResearchListCommand(api);

    // --- Tools (agent-callable functions) ---
    registerRunPipelineTool(api);
    registerSteerPipelineTool(api);
    registerGetResultsTool(api);
    registerApproveMilestoneTool(api);

    // --- Background Services ---
    registerProgressPoller(api);

    // --- Lifecycle Hooks ---
    (api as any).on?.('shutdown', () => {
      // Clean up any running pipelines on gateway shutdown
      for (const [id, run] of activeRuns) {
        if (run.status === 'running' || run.status === 'starting') {
          try {
            run.process.kill('SIGTERM');
          } catch {
            // Process may already be dead
          }
        }
      }
    });

    (api as any).log?.('info', 'pAI/MSc-openclaw plugin loaded. Use /pai-msc "hypothesis" to start.');
  },
});
