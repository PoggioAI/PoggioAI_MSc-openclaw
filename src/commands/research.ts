/**
 * /pai-msc command — the primary user entry point.
 *
 * Usage:
 *   /pai-msc "Investigate whether batch normalization implicitly regularizes..."
 *   /pai-msc --preset fast "quick hypothesis"
 *   /pai-msc --model claude-sonnet-4-6 --budget 25 "hypothesis"
 *   /pai-msc --resume /path/to/workspace "hypothesis"
 *   /pai-msc --style-guide /path/to/guide.md "hypothesis"
 *   /pai-msc --attach /path/to/paper.pdf "hypothesis"
 *   /pai-msc --no-upload-prompt "hypothesis"
 *   /pai-msc --dry-run "hypothesis"
 *
 * Flow (workspace-first architecture):
 *   1. Parse arguments
 *   2. Check prerequisites + auto-install
 *   3. Resolve options from preset + overrides
 *   4. Create run workspace (initial_context/, logs/, etc.)
 *   5. Inject quality artifacts to initial_context/ (no polling)
 *   6. Write task.txt and pipeline_options.json
 *   7. Prompt for file uploads (with timeout/fallback)
 *   8. Write .env to run dir + .llm_config.yaml
 *   9. Spawn pipeline (with --resume pointing to our workspace)
 *  10. Register run, send launch confirmation
 */
import path from 'path';
import { activeRuns, runHistory, getConfig, getConsortiumDir } from '../index.js';
import { resolveOptions } from '../defaults/quality-presets.js';
import { PipelineOptions } from '../types/pipeline.js';
import { OpenClawApi } from '../types/openclaw-api.js';
import { isInstalled, checkPrereqs, checkOptionalDeps, install } from '../services/installer.js';
import { writeEnvFile, canUseCounsel } from '../bridge/env-passthrough.js';
import { writeConfig } from '../bridge/config-writer.js';
import { injectToInitialContext } from '../services/quality-injector.js';
import { createRunWorkspace, writeTaskFile, writePipelineOptions } from '../services/workspace-manager.js';
import { promptForUploads } from '../services/upload-handler.js';
import { spawnPipeline } from '../services/process-manager.js';

/**
 * Parse command arguments into PipelineOptions.
 */
function parseArgs(argsStr: string): { task: string; overrides: Partial<PipelineOptions> } {
  const overrides: Partial<PipelineOptions> = {};
  let task = '';

  // Simple argument parsing — extract quoted task and flags
  const parts = argsStr.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];

    if (part.startsWith('--')) {
      const flag = part.slice(2);
      switch (flag) {
        case 'preset':
          overrides.preset = parts[++i] as any;
          break;
        case 'model':
          overrides.model = parts[++i];
          break;
        case 'budget':
          overrides.budgetUsd = parseFloat(parts[++i]);
          break;
        case 'output':
          overrides.outputFormat = parts[++i] as any;
          break;
        case 'mode':
          overrides.mode = parts[++i] as any;
          break;
        case 'math':
          overrides.enableMathAgents = true;
          break;
        case 'no-math':
          overrides.enableMathAgents = false;
          break;
        case 'counsel':
          overrides.enableCounsel = true;
          break;
        case 'no-counsel':
          overrides.enableCounsel = false;
          break;
        case 'tree-search':
          overrides.enableTreeSearch = true;
          break;
        case 'explore':
          overrides.enableExploreMode = true;
          break;
        case 'style-guide':
          overrides.styleGuidePath = parts[++i]?.replace(/"/g, '');
          break;
        case 'resume':
          overrides.resumePath = parts[++i]?.replace(/"/g, '');
          break;
        case 'dry-run':
          overrides.dryRun = true;
          break;
        case 'no-upload-prompt':
          overrides.skipUploadPrompt = true;
          break;
        case 'attach': {
          const filePath = parts[++i]?.replace(/"/g, '');
          if (filePath) {
            if (!overrides.attachFiles) overrides.attachFiles = [];
            overrides.attachFiles.push(filePath);
          }
          break;
        }
        default:
          // Unknown flag — might be part of task
          break;
      }
    } else {
      // Unquoted or quoted positional argument = task
      task = part.replace(/^"|"$/g, '');
    }

    i++;
  }

  return { task, overrides };
}

/**
 * Register the /pai-msc command with OpenClaw.
 */
export function registerResearchCommand(api: any): void {
  const typedApi = api as OpenClawApi;

  api.registerCommand({
    name: 'pai-msc',
    description:
      'Run the pAI/MSc-openclaw research pipeline. ' +
      'Transforms a hypothesis into a conference-grade manuscript.',
    usage:
      '/pai-msc "your hypothesis" [--preset max-quality|fast] [--model MODEL] ' +
      '[--budget USD] [--attach FILE] [--no-upload-prompt] [--dry-run]',

    async handler(args: string) {
      const config = getConfig(api);
      const consortiumDir = getConsortiumDir(config);
      const pluginDir = __dirname.replace(/\/src\/commands$/, '').replace(/\/dist\/commands$/, '');

      // ── Welcome Banner ─────────────────────────────────────────────
      typedApi.sendMessage(
        '```\n' +
        '================================================================\n' +
        '  pAI/MSc-openclaw — Autonomous Research Pipeline\n' +
        '================================================================\n' +
        '\n' +
        '  Thanks from the PoggioAI Team for using this tool!\n' +
        '\n' +
        '  Contact us:\n' +
        '    Discord: https://discord.gg/Pz7spPPY\n' +
        '    Email:   pierb@mit.edu\n' +
        '\n' +
        '  Please acknowledge PoggioAI in your papers and cite our\n' +
        '  technical report if you use this tool:\n' +
        '    https://poggioai.github.io/papers/poggioai-msc-v0.pdf\n' +
        '\n' +
        '================================================================\n' +
        '```',
      );

      // ── Step 1: Parse arguments ────────────────────────────────────
      const { task, overrides } = parseArgs(args);

      if (!task && !overrides.resumePath) {
        typedApi.sendMessage(
          '**Usage:** `/pai-msc "your hypothesis"`\n\n' +
            'Options:\n' +
            '- `--preset max-quality|fast` — quality preset (default: max-quality)\n' +
            '- `--model MODEL` — LLM model override\n' +
            '- `--budget USD` — budget cap in dollars\n' +
            '- `--output latex|markdown` — output format\n' +
            '- `--math` / `--no-math` — enable/disable theory track\n' +
            '- `--counsel` / `--no-counsel` — enable/disable multi-model debate\n' +
            '- `--tree-search` — enable tree search for proofs\n' +
            '- `--explore` — explore mode: 2-5 exploration cycles then 1 final paper cycle\n' +
            '- `--style-guide PATH` — custom author style guide\n' +
            '- `--attach PATH` — attach reference file (repeatable)\n' +
            '- `--no-upload-prompt` — skip file upload prompt\n' +
            '- `--resume PATH` — resume from prior workspace\n' +
            '- `--dry-run` — validate without API calls\n\n' +
            'Example:\n' +
            '`/pai-msc "Investigate whether batch normalization implicitly regularizes spectral norm"`',
        );
        return;
      }

      // ── Step 2: Resolve options from preset + overrides ────────────
      const preset = overrides.preset ?? config.defaultPreset;
      const options = resolveOptions(task || 'Resume prior run', preset, overrides);

      // Check if counsel is requested but not possible
      if (options.enableCounsel && !canUseCounsel()) {
        typedApi.sendMessage(
          '**Warning:** Counsel mode requires ANTHROPIC, OPENAI, and GOOGLE API keys. ' +
            'Only some are configured. Disabling counsel mode.',
        );
        options.enableCounsel = false;
      }

      // ── Step 3: Check prerequisites ────────────────────────────────
      const prereqErrors = checkPrereqs();
      if (prereqErrors.length > 0) {
        typedApi.sendMessage(
          '**Setup Required:**\n' + prereqErrors.map((e) => `- ${e}`).join('\n'),
        );
        return;
      }

      // ── Step 4: Auto-install if needed ─────────────────────────────
      if (!isInstalled(consortiumDir)) {
        typedApi.sendMessage(
          '**First-time setup** — installing pAI/MSc-openclaw research pipeline (~5 minutes)...',
        );
        try {
          await install(consortiumDir, config, pluginDir, (msg) => {
            typedApi.sendMessage(`*Setup:* ${msg}`);
          });
        } catch (err: any) {
          typedApi.sendMessage(`**Installation failed:** ${err.message}`);
          return;
        }
      }

      // ── Step 5: Check optional deps ────────────────────────────────
      const warnings = checkOptionalDeps();
      if (warnings.length > 0 && options.outputFormat === 'latex') {
        for (const warn of warnings) {
          typedApi.sendMessage(`**Warning:** ${warn}`);
        }
        if (warnings.some((w) => w.includes('pdflatex'))) {
          typedApi.sendMessage('Degrading output to markdown since pdflatex is missing.');
          options.outputFormat = 'markdown';
          options.requirePdf = false;
        }
      }

      // ── Step 6: Create run workspace ───────────────────────────────
      // Generate a unique run ID and create the full directory tree
      const now = new Date();
      const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const rand = Math.random().toString(36).slice(2, 6);
      const runId = `run-${ts}-${rand}`;

      const workspace = createRunWorkspace(runId);

      // ── Step 7: Inject quality artifacts to initial_context/ ───────
      // No polling needed — workspace exists, inject immediately
      try {
        injectToInitialContext(workspace, options);
      } catch (err: any) {
        typedApi.sendMessage(`*Warning: quality injection failed:* ${err.message}`);
      }

      // ── Step 8: Write task and options snapshots ────────────────────
      writeTaskFile(workspace, options.task);
      writePipelineOptions(workspace, options);

      // ── Step 9: Prompt for file uploads ────────────────────────────
      const uploadedFiles = await promptForUploads(typedApi, workspace, {
        timeoutMs: config.uploadTimeoutMs ?? 60000,
        skipPrompt: options.skipUploadPrompt ?? false,
        localFiles: options.attachFiles ?? [],
      });

      if (uploadedFiles.length > 0) {
        options.uploadedFilePaths = uploadedFiles;
        const fileList = uploadedFiles.map((f) => path.basename(f)).join(', ');
        options.task += `\n\n[Reference files provided: ${fileList}. ` +
          `They are available at: ${workspace.uploadsDir}]`;
        typedApi.sendMessage(`**${uploadedFiles.length} file(s) attached.** Proceeding.`);
      }

      // ── Step 10: Write .env and .llm_config.yaml ───────────────────
      try {
        const providers = writeEnvFile(workspace.runDir);
        typedApi.sendMessage(`*API keys configured:* ${providers.join(', ')}`);
      } catch (err: any) {
        typedApi.sendMessage(`**Error:** ${err.message}`);
        return;
      }

      // Write config to run dir (archival) + consortium root (for CWD loading)
      writeConfig(workspace.runDir, options, consortiumDir);

      // ── Step 11: Dry run check ─────────────────────────────────────
      if (options.dryRun) {
        typedApi.sendMessage(
          '**Dry run complete.** Configuration validated.\n\n' +
            `**Workspace:** \`${workspace.runDir}\`\n` +
            `**Initial context:** ${uploadedFiles.length} file(s) attached\n` +
            `**Model:** ${options.model} | **Budget:** $${options.budgetUsd}\n` +
            `**Features:** ${[
              options.enableMathAgents ? 'math' : null,
              options.enableCounsel ? 'counsel' : null,
              options.enableTreeSearch ? 'tree-search' : null,
              options.enableExploreMode ? 'explore mode' : null,
            ].filter(Boolean).join(', ') || 'standard'}`,
        );
        return;
      }

      // ── Step 12: Spawn pipeline ────────────────────────────────────
      const run = spawnPipeline(options, workspace, consortiumDir, config);

      // Register run
      activeRuns.set(run.id, run);
      runHistory.push(run);

      // ── Step 13: Send launch confirmation ──────────────────────────
      const launchMsg = [
        `**Research Pipeline Started** (${run.id})`,
        '',
        `**Task:** ${options.task.slice(0, 150)}${options.task.length > 150 ? '...' : ''}`,
        `**Preset:** ${options.preset} | **Model:** ${options.model}`,
        `**Budget:** $${options.budgetUsd} | **Output:** ${options.outputFormat}`,
        `**Features:** ${[
          options.enableMathAgents ? 'math' : null,
          options.enableCounsel ? 'counsel' : null,
          options.enableTreeSearch ? 'tree-search' : null,
          options.enableExploreMode ? 'explore mode' : null,
        ].filter(Boolean).join(', ') || 'standard'}`,
        `**Multi-pass:** ${options.writeupPasses} writeup passes | ${options.personaDebateRounds} persona rounds | ${options.minPassesPerPhase} min passes/phase`,
        uploadedFiles.length > 0
          ? `**Attached:** ${uploadedFiles.length} reference file(s)`
          : '',
        '',
        `**Workspace:** \`${workspace.runDir}\``,
        '',
        'Progress updates will appear as the pipeline runs.',
        'Use `/pai-msc-status` to check progress or `/pai-msc-stop` to cancel.',
      ]
        .filter(Boolean)
        .join('\n');

      typedApi.sendMessage(launchMsg);
    },
  });
}
