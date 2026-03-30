/**
 * Auto-Installer for the PoggioAI/MSc consortium Python backend.
 *
 * On first use, clones the repo, creates a conda environment,
 * installs dependencies, patches prompts with backtested versions,
 * and runs the preflight check.
 *
 * Subsequent runs skip installation via a sentinel file.
 */
import { execSync, ExecSyncOptions } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { PluginConfig } from '../types/config.js';

const REPO_URL = 'https://github.com/PoggioAI/PoggioAI_MSc.git';
const SENTINEL_FILE = '.installed';
const PLUGIN_VERSION = '0.1.0';

/**
 * Check whether conda is available on the system.
 */
function hasCommand(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a shell command with logging, throwing on failure.
 */
function run(
  cmd: string,
  opts: ExecSyncOptions & { label?: string } = {},
): string {
  const { label, ...execOpts } = opts;
  try {
    const result = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 600_000, // 10 minutes max per step
      ...execOpts,
    });
    return result?.toString() ?? '';
  } catch (err: any) {
    const msg = err.stderr?.toString() ?? err.message;
    throw new Error(`${label ?? cmd} failed: ${msg}`);
  }
}

/**
 * Status callback type for progress messages.
 */
type StatusCallback = (message: string) => void;

/**
 * Check if consortium is already installed and ready.
 */
export function isInstalled(consortiumDir: string): boolean {
  const sentinel = path.join(consortiumDir, SENTINEL_FILE);
  if (!existsSync(sentinel)) return false;

  // Verify critical files still exist
  const criticalFiles = [
    'launch_multiagent.py',
    'consortium/__init__.py',
    'consortium/runner.py',
    'consortium/graph.py',
  ];

  return criticalFiles.every((f) =>
    existsSync(path.join(consortiumDir, f)),
  );
}

/**
 * Check prerequisites before installation.
 * Returns an array of error messages (empty = all good).
 */
export function checkPrereqs(): string[] {
  const errors: string[] = [];

  if (!hasCommand('conda') && !hasCommand('python3')) {
    errors.push(
      'Neither conda nor python3 found on PATH. ' +
        'Install Miniconda: https://docs.conda.io/en/latest/miniconda.html',
    );
  }

  if (!hasCommand('git')) {
    errors.push('git not found on PATH. Install git to continue.');
  }

  return errors;
}

/**
 * Check for optional dependencies and return warnings.
 */
export function checkOptionalDeps(): string[] {
  const warnings: string[] = [];

  if (!hasCommand('pdflatex')) {
    warnings.push(
      'pdflatex not found. LaTeX output will degrade to markdown. ' +
        'Install TeX Live for PDF support: brew install --cask mactex-no-gui',
    );
  }

  if (!hasCommand('bibtex')) {
    warnings.push(
      'bibtex not found. Bibliography compilation may fail.',
    );
  }

  return warnings;
}

/**
 * Perform full installation of the consortium backend.
 *
 * Steps:
 * 1. Clone the repo
 * 2. Create conda env (or venv fallback)
 * 3. Install Python dependencies
 * 4. Patch prompts with backtested versions
 * 5. Run preflight check
 * 6. Write sentinel file
 */
export async function install(
  consortiumDir: string,
  config: PluginConfig,
  pluginDir: string,
  onStatus: StatusCallback,
): Promise<void> {
  const parentDir = path.dirname(consortiumDir);
  const useConda = hasCommand('conda');
  const envName = config.condaEnvName;

  // Step 1: Clone
  if (!existsSync(path.join(consortiumDir, '.git'))) {
    onStatus('Cloning PoggioAI/MSc repository...');
    mkdirSync(parentDir, { recursive: true });
    run(`git clone --depth 1 ${REPO_URL} "${consortiumDir}"`, {
      label: 'git clone',
    });
  } else {
    onStatus('Repository already cloned. Checking for updates...');
    try {
      run('git pull --ff-only', { cwd: consortiumDir, label: 'git pull' });
    } catch {
      // Non-fatal: offline or diverged
      onStatus('Could not pull updates (offline?). Using existing code.');
    }
  }

  // Step 2: Create Python environment
  if (useConda) {
    onStatus(`Creating conda environment '${envName}' with Python 3.11...`);
    try {
      // Check if env already exists
      const envList = run('conda env list', { label: 'conda env list' });
      if (!envList.includes(envName)) {
        run(`conda create -n ${envName} python=3.11 -y`, {
          label: 'conda create',
        });
      } else {
        onStatus(`Conda environment '${envName}' already exists.`);
      }
    } catch (err: any) {
      throw new Error(`Failed to create conda environment: ${err.message}`);
    }
  } else {
    onStatus('Conda not found. Creating Python venv as fallback...');
    const venvDir = path.join(consortiumDir, '.venv');
    if (!existsSync(venvDir)) {
      run(`python3 -m venv "${venvDir}"`, { label: 'create venv' });
    }
    onStatus(
      'Warning: venv mode may have limited torch/CUDA support. ' +
        'Install Miniconda for full GPU support.',
    );
  }

  // Step 3: Install dependencies
  onStatus('Installing Python dependencies (this may take a few minutes)...');
  const pipPrefix = useConda
    ? `conda run -n ${envName} --no-banner pip`
    : `"${path.join(consortiumDir, '.venv', 'bin', 'pip')}"`;

  run(`${pipPrefix} install -e ".[core,web]"`, {
    cwd: consortiumDir,
    label: 'pip install',
    timeout: 900_000, // 15 minutes for large installs
  });

  // Step 4: Patch prompts with backtested versions
  onStatus('Injecting backtested quality prompts...');
  patchPrompts(consortiumDir, pluginDir);

  // Step 5: Run preflight check
  onStatus('Running preflight checks...');
  const runPrefix = useConda
    ? `conda run -n ${envName} --no-banner python`
    : `"${path.join(consortiumDir, '.venv', 'bin', 'python')}"`;
  try {
    run(`${runPrefix} scripts/preflight_check.py`, {
      cwd: consortiumDir,
      label: 'preflight',
    });
  } catch {
    onStatus(
      'Preflight check had warnings (non-fatal). Continuing...',
    );
  }

  // Step 6: Write sentinel
  const sentinel = path.join(consortiumDir, SENTINEL_FILE);
  writeFileSync(
    sentinel,
    JSON.stringify({
      version: PLUGIN_VERSION,
      installedAt: new Date().toISOString(),
      condaEnv: useConda ? envName : null,
      venvPath: useConda ? null : path.join(consortiumDir, '.venv'),
    }),
  );

  onStatus('Installation complete!');
}

/**
 * Prompt-to-consortium mapping for patching instruction files.
 *
 * Each entry maps a skill prompt file to the consortium instruction file
 * and the variable name that holds the instruction string.
 */
const PROMPT_MAP: Array<{
  skillPrompt: string;
  consortiumFile: string;
  variableName: string;
}> = [
  {
    skillPrompt: '01-persona-practical.md',
    consortiumFile: 'consortium/prompts/persona_instructions.py',
    variableName: 'PRACTICAL_COMPASS_INSTRUCTIONS',
  },
  {
    skillPrompt: '02-persona-rigor.md',
    consortiumFile: 'consortium/prompts/persona_instructions.py',
    variableName: 'RIGOR_NOVELTY_INSTRUCTIONS',
  },
  {
    skillPrompt: '03-persona-narrative.md',
    consortiumFile: 'consortium/prompts/persona_instructions.py',
    variableName: 'NARRATIVE_ARCHITECT_INSTRUCTIONS',
  },
  {
    skillPrompt: '04-persona-synthesis.md',
    consortiumFile: 'consortium/prompts/persona_instructions.py',
    variableName: 'SYNTHESIS_INSTRUCTIONS',
  },
  {
    skillPrompt: '05-literature-review.md',
    consortiumFile: 'consortium/prompts/literature_review_instructions.py',
    variableName: 'LITERATURE_REVIEW_INSTRUCTIONS',
  },
  {
    skillPrompt: '06-brainstorm.md',
    consortiumFile: 'consortium/prompts/brainstorm_instructions.py',
    variableName: 'BRAINSTORM_INSTRUCTIONS',
  },
  {
    skillPrompt: '07-formalize-goals.md',
    consortiumFile: 'consortium/prompts/formalize_goals_instructions.py',
    variableName: 'FORMALIZE_GOALS_INSTRUCTIONS',
  },
  {
    skillPrompt: '18-writeup.md',
    consortiumFile: 'consortium/prompts/writeup_instructions.py',
    variableName: 'WRITEUP_INSTRUCTIONS',
  },
  {
    skillPrompt: '19-proofreading.md',
    consortiumFile: 'consortium/prompts/proofreading_instructions.py',
    variableName: 'PROOFREADING_INSTRUCTIONS',
  },
  {
    skillPrompt: '20-reviewer.md',
    consortiumFile: 'consortium/prompts/reviewer_instructions.py',
    variableName: 'REVIEWER_INSTRUCTIONS',
  },
  {
    skillPrompt: '16-duality-check.md',
    consortiumFile: 'consortium/prompts/duality_check_instructions.py',
    variableName: 'DUALITY_CHECK_INSTRUCTIONS',
  },
];

/**
 * Patch consortium prompt files by appending a loader that reads
 * the backtested markdown prompts from the plugin's assets directory.
 *
 * This preserves the original prompts as fallbacks — if the skill prompt
 * file doesn't exist at runtime, the original Python string is used.
 */
function patchPrompts(consortiumDir: string, pluginDir: string): void {
  const promptsSource = path.join(pluginDir, 'assets', 'prompts');

  // Also copy all prompts to consortium's knowledge directory
  // so agents can reference them
  const knowledgeDir = path.join(consortiumDir, 'knowledge', 'skill_prompts');
  mkdirSync(knowledgeDir, { recursive: true });

  for (const mapping of PROMPT_MAP) {
    const skillPromptPath = path.join(promptsSource, mapping.skillPrompt);
    const consortiumFilePath = path.join(consortiumDir, mapping.consortiumFile);

    if (!existsSync(skillPromptPath) || !existsSync(consortiumFilePath)) {
      continue;
    }

    // Copy skill prompt to knowledge dir for runtime access
    const destPath = path.join(knowledgeDir, mapping.skillPrompt);
    const content = readFileSync(skillPromptPath, 'utf-8');
    writeFileSync(destPath, content);

    // Append loader to consortium instruction file
    const pyFile = readFileSync(consortiumFilePath, 'utf-8');
    const patchMarker = `# [POGGIOAI-OPENCLAW-PATCH:${mapping.variableName}]`;

    if (pyFile.includes(patchMarker)) {
      continue; // Already patched
    }

    const patch = `
${patchMarker}
import os as _os
_skill_prompt_path = _os.path.join(
    _os.path.dirname(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))),
    "knowledge", "skill_prompts", "${mapping.skillPrompt}"
)
if _os.path.exists(_skill_prompt_path):
    with open(_skill_prompt_path, "r") as _f:
        ${mapping.variableName} = _f.read()
`;

    writeFileSync(consortiumFilePath, pyFile + patch);
  }

  // Copy prompts that don't have direct consortium mappings
  // (they'll be injected via workspace at runtime)
  const allPrompts = [
    '08-math-literature.md',
    '09-math-proposer.md',
    '10-math-prover.md',
    '11-math-verifier.md',
    '12-experiment-design.md',
    '13-experimentation.md',
    '14-experiment-verify.md',
    '15-formalize-results.md',
    '17-resource-prep.md',
    '21-research-plan-writeup.md',
    '22-track-merge.md',
    '23-verify-completion.md',
    '24-followup-lit-review.md',
    '25-narrative-voice.md',
  ];

  for (const promptFile of allPrompts) {
    const src = path.join(promptsSource, promptFile);
    const dest = path.join(knowledgeDir, promptFile);
    if (existsSync(src)) {
      writeFileSync(dest, readFileSync(src, 'utf-8'));
    }
  }
}
