/**
 * Quality Injector — copies backtested prompts, style guide, and
 * quality configuration into the workspace before each pipeline run.
 *
 * This ensures every run benefits from the skill's quality improvements
 * regardless of what's in the consortium's built-in prompts.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { PipelineOptions } from '../types/pipeline.js';
import { RunWorkspace } from './workspace-manager.js';

/**
 * Resolve the plugin's assets directory.
 * Works both in dev (src/../assets) and built (dist/../assets).
 */
function getAssetsDir(): string {
  // Walk up from this file to find the assets directory
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    const assetsPath = path.join(dir, 'assets');
    if (existsSync(assetsPath)) return assetsPath;
    dir = path.dirname(dir);
  }
  throw new Error('Could not find assets directory. Is the plugin installed correctly?');
}

/**
 * Inject all quality artifacts into the workspace before a pipeline run.
 *
 * 1. Copies author_style_guide.md (user-provided > bundled default)
 * 2. Copies all 25 prompt files to paper_workspace/skill_prompts/
 * 3. Creates state_template.json for tracking
 */
export function injectQualityArtifacts(
  workspaceDir: string,
  options: PipelineOptions,
): void {
  const assetsDir = getAssetsDir();
  const paperWorkspace = path.join(workspaceDir, 'paper_workspace');
  mkdirSync(paperWorkspace, { recursive: true });

  // 1. Style guide
  injectStyleGuide(paperWorkspace, assetsDir, options.styleGuidePath);

  // 2. Prompt files (for agents that read workspace files)
  injectPrompts(paperWorkspace, assetsDir);

  // 3. State template
  injectStateTemplate(workspaceDir, assetsDir);
}

/**
 * Copy the author style guide into the workspace.
 * Priority: user-provided > bundled default.
 */
function injectStyleGuide(
  paperWorkspace: string,
  assetsDir: string,
  userStyleGuidePath?: string,
): void {
  const destPath = path.join(paperWorkspace, 'author_style_guide.md');

  if (userStyleGuidePath && existsSync(userStyleGuidePath)) {
    copyFileSync(userStyleGuidePath, destPath);
  } else {
    const defaultGuide = path.join(assetsDir, 'author_style_guide_default.md');
    if (existsSync(defaultGuide)) {
      copyFileSync(defaultGuide, destPath);
    }
  }
}

/**
 * Copy all 25 prompt files to the workspace for runtime reference.
 * Agents that read workspace files can find these as supplementary context.
 */
function injectPrompts(paperWorkspace: string, assetsDir: string): void {
  const promptsSrc = path.join(assetsDir, 'prompts');
  const promptsDest = path.join(paperWorkspace, 'skill_prompts');
  mkdirSync(promptsDest, { recursive: true });

  const promptFiles = [
    '01-persona-practical.md',
    '02-persona-rigor.md',
    '03-persona-narrative.md',
    '04-persona-synthesis.md',
    '05-literature-review.md',
    '06-brainstorm.md',
    '07-formalize-goals.md',
    '08-math-literature.md',
    '09-math-proposer.md',
    '10-math-prover.md',
    '11-math-verifier.md',
    '12-experiment-design.md',
    '13-experimentation.md',
    '14-experiment-verify.md',
    '15-formalize-results.md',
    '16-duality-check.md',
    '17-resource-prep.md',
    '18-writeup.md',
    '19-proofreading.md',
    '20-reviewer.md',
    '21-research-plan-writeup.md',
    '22-track-merge.md',
    '23-verify-completion.md',
    '24-followup-lit-review.md',
    '25-narrative-voice.md',
  ];

  for (const file of promptFiles) {
    const src = path.join(promptsSrc, file);
    const dest = path.join(promptsDest, file);
    if (existsSync(src)) {
      copyFileSync(src, dest);
    }
  }
}

/**
 * Copy state template to workspace for tracking.
 */
function injectStateTemplate(workspaceDir: string, assetsDir: string): void {
  const src = path.join(assetsDir, 'state_template.json');
  const dest = path.join(workspaceDir, 'state.json');
  if (existsSync(src) && !existsSync(dest)) {
    const template = JSON.parse(readFileSync(src, 'utf-8'));
    template.started_at = new Date().toISOString();
    template.workspace = workspaceDir;
    writeFileSync(dest, JSON.stringify(template, null, 2));
  }
}

/**
 * Read the narrative voice prompt from assets for the pre-writeup hook.
 */
export function getNarrativeVoicePrompt(): string {
  const assetsDir = getAssetsDir();
  const promptPath = path.join(assetsDir, 'prompts', '25-narrative-voice.md');
  if (!existsSync(promptPath)) {
    throw new Error('Narrative voice prompt not found in assets/prompts/25-narrative-voice.md');
  }
  return readFileSync(promptPath, 'utf-8');
}

// ─── initial_context/ Injection (new workspace-first flow) ───────────

/**
 * All prompt filenames to copy.
 */
const PROMPT_FILES = [
  '01-persona-practical.md',
  '02-persona-rigor.md',
  '03-persona-narrative.md',
  '04-persona-synthesis.md',
  '05-literature-review.md',
  '06-brainstorm.md',
  '07-formalize-goals.md',
  '08-math-literature.md',
  '09-math-proposer.md',
  '10-math-prover.md',
  '11-math-verifier.md',
  '12-experiment-design.md',
  '13-experimentation.md',
  '14-experiment-verify.md',
  '15-formalize-results.md',
  '16-duality-check.md',
  '17-resource-prep.md',
  '18-writeup.md',
  '19-proofreading.md',
  '20-reviewer.md',
  '21-research-plan-writeup.md',
  '22-track-merge.md',
  '23-verify-completion.md',
  '24-followup-lit-review.md',
  '25-narrative-voice.md',
];

/**
 * Inject all quality artifacts into initial_context/ BEFORE pipeline spawn.
 *
 * This replaces the old injectQualityArtifacts() which required polling
 * for the workspace directory. With the workspace-first flow, we create
 * the workspace ourselves and inject artifacts immediately.
 *
 * Copies:
 * 1. Author style guide → initial_context/author_style_guide.md
 * 2. All 25 prompts → initial_context/prompts/
 * 3. State template → {runDir}/state.json
 *
 * Also copies to paper_workspace/ for runtime access by consortium agents.
 */
export function injectToInitialContext(
  workspace: RunWorkspace,
  options: PipelineOptions,
): void {
  const assetsDir = getAssetsDir();

  // 1. Style guide → initial_context/ + paper_workspace/
  const styleGuideSrc = options.styleGuidePath && existsSync(options.styleGuidePath)
    ? options.styleGuidePath
    : path.join(assetsDir, 'author_style_guide_default.md');

  if (existsSync(styleGuideSrc)) {
    copyFileSync(styleGuideSrc, path.join(workspace.initialContextDir, 'author_style_guide.md'));

    // Also copy to paper_workspace/ where the writeup agent expects it
    const paperWorkspace = path.join(workspace.runDir, 'paper_workspace');
    mkdirSync(paperWorkspace, { recursive: true });
    copyFileSync(styleGuideSrc, path.join(paperWorkspace, 'author_style_guide.md'));
  }

  // 2. All 25 prompt files → initial_context/prompts/ + paper_workspace/skill_prompts/
  const promptsSrc = path.join(assetsDir, 'prompts');
  const skillPromptsDest = path.join(workspace.runDir, 'paper_workspace', 'skill_prompts');
  mkdirSync(skillPromptsDest, { recursive: true });

  for (const file of PROMPT_FILES) {
    const src = path.join(promptsSrc, file);
    if (existsSync(src)) {
      // Archive copy in initial_context/prompts/
      copyFileSync(src, path.join(workspace.promptsDir, file));
      // Runtime copy in paper_workspace/skill_prompts/
      copyFileSync(src, path.join(skillPromptsDest, file));
    }
  }

  // 3. State template → {runDir}/state.json
  const stateSrc = path.join(assetsDir, 'state_template.json');
  const stateDest = path.join(workspace.runDir, 'state.json');
  if (existsSync(stateSrc) && !existsSync(stateDest)) {
    const template = JSON.parse(readFileSync(stateSrc, 'utf-8'));
    template.started_at = new Date().toISOString();
    template.workspace = workspace.runDir;
    writeFileSync(stateDest, JSON.stringify(template, null, 2));

    // Also copy raw template to initial_context/ for archival
    copyFileSync(stateSrc, path.join(workspace.initialContextDir, 'state_template.json'));
  }
}
