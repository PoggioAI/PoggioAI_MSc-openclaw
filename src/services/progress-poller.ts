/**
 * Progress Poller — background service that monitors active pipeline runs
 * and sends progress updates to the user's channel.
 *
 * Responsibilities:
 * 1. Detect stage transitions from stdout parsing
 * 2. Poll budget_state.json for spend tracking
 * 3. Send budget threshold notifications (25%, 50%, 75%, 90%)
 * 4. Inject narrative voice before writeup (automated steering hook)
 * 5. Detect review score and escalate if critically low
 * 6. Send completion/failure messages with paper delivery
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { activeRuns, getConfig } from '../index.js';
import { RunHandle } from '../types/pipeline.js';
import { BudgetState, BUDGET_THRESHOLDS } from '../types/budget.js';
import { ReviewVerdict } from '../types/steering.js';
import { SteeringClient } from '../bridge/steering-client.js';
import { getNarrativeVoicePrompt } from './quality-injector.js';
import {
  readBudgetState,
  readReviewVerdict,
  composeCompletionMessage,
  composeFailureMessage,
  findPaperFile,
} from '../bridge/result-reader.js';
import { getStageDisplay, getStageIndex, PIPELINE_STAGES } from '../defaults/stage-names.js';

/** Track which budget thresholds have been notified per run. */
const notifiedThresholds = new Map<string, Set<number>>();

/** Track last known stage per run (to detect transitions). */
const lastKnownStage = new Map<string, string>();

/** Track whether completion message has been sent. */
const completionSent = new Set<string>();

/**
 * Register the progress poller as an OpenClaw background service.
 */
export function registerProgressPoller(api: any): void {
  const config = getConfig(api);
  const pollInterval = config.progressPollIntervalMs || 15000;

  // Start polling loop
  setInterval(() => {
    for (const [id, run] of activeRuns) {
      try {
        pollRun(run, api);
      } catch (err: any) {
        // Non-fatal: log and continue
        api.log?.('warn', `Progress poll error for ${id}: ${err.message}`);
      }
    }
  }, pollInterval);
}

/**
 * Poll a single run for updates.
 */
function pollRun(run: RunHandle, api: any): void {
  // Skip if already finalized
  if (completionSent.has(run.id)) return;

  // Initialize tracking state
  if (!notifiedThresholds.has(run.id)) {
    notifiedThresholds.set(run.id, new Set());
  }

  // Check for stage transitions
  checkStageTransition(run, api);

  // Check budget thresholds
  if (run.workspaceDir) {
    checkBudgetThresholds(run, api);
  }

  // Check for narrative voice injection point
  checkNarrativeVoiceHook(run, api);

  // Check for review score escalation
  checkReviewEscalation(run, api);

  // Check for completion/failure
  checkCompletion(run, api);
}

/**
 * Detect stage transitions and send progress messages.
 */
function checkStageTransition(run: RunHandle, api: any): void {
  const current = run.currentStage;
  const last = lastKnownStage.get(run.id);

  if (current && current !== last) {
    lastKnownStage.set(run.id, current);

    const stageIndex = getStageIndex(current);
    const stageDisplay = getStageDisplay(current);
    const elapsed = Math.round((Date.now() - run.startedAt.getTime()) / 1000);
    const elapsedStr = elapsed < 60
      ? `${elapsed}s`
      : `${Math.floor(elapsed / 60)}m`;

    let budgetStr = '';
    if (run.workspaceDir) {
      const budget = readBudgetState(run.workspaceDir);
      if (budget) {
        run.budgetUsed = budget.total_usd;
        budgetStr = ` | $${budget.total_usd.toFixed(2)}`;
      }
    }

    const progress = stageIndex > 0
      ? `${stageIndex}/${PIPELINE_STAGES.length}`
      : '...';

    api.sendMessage(
      `**[${progress}]** ${stageDisplay} (${elapsedStr}${budgetStr})`,
    );
  }
}

/**
 * Check budget thresholds and send notifications.
 */
function checkBudgetThresholds(run: RunHandle, api: any): void {
  const budget = readBudgetState(run.workspaceDir);
  if (!budget || budget.usd_limit <= 0) return;

  const ratio = budget.total_usd / budget.usd_limit;
  const thresholds = notifiedThresholds.get(run.id)!;

  for (const threshold of BUDGET_THRESHOLDS) {
    if (ratio >= threshold && !thresholds.has(threshold)) {
      thresholds.add(threshold);
      const pct = Math.round(threshold * 100);
      api.sendMessage(
        `**Budget ${pct}%:** $${budget.total_usd.toFixed(2)} / $${budget.usd_limit.toFixed(2)}`,
      );
    }
  }

  run.budgetUsed = budget.total_usd;
}

/**
 * Narrative Voice Hook — inject narrative_brief.md before writeup starts.
 *
 * When resource_preparation_agent completes and writeup_agent is about to start,
 * this hook pauses the pipeline, generates a narrative brief using the
 * backtested prompt, writes it to the workspace, and resumes.
 */
async function checkNarrativeVoiceHook(run: RunHandle, api: any): Promise<void> {
  // Only inject once
  if (run.narrativeVoiceInjected) return;

  // Trigger when we detect writeup_agent starting
  if (run.currentStage !== 'writeup_agent') return;

  // Check if narrative_brief.md already exists (e.g., from a resume)
  if (run.workspaceDir) {
    const briefPath = path.join(run.workspaceDir, 'paper_workspace', 'narrative_brief.md');
    if (existsSync(briefPath)) {
      run.narrativeVoiceInjected = true;
      return;
    }
  }

  run.narrativeVoiceInjected = true; // Mark immediately to prevent re-entry

  try {
    const steering = new SteeringClient(run.steeringPort);

    // Wait for steering server to be ready
    const ready = await steering.waitForReady(10000);
    if (!ready) {
      api.log?.('warn', 'Steering server not ready for narrative voice injection');
      return;
    }

    // Pause pipeline
    await steering.pause();

    api.sendMessage(
      '*Injecting narrative voice guidance before writeup...*',
    );

    // Read workspace artifacts for context
    const resultsPath = path.join(run.workspaceDir, 'paper_workspace', 'formalized_results.json');
    const resourcePath = path.join(run.workspaceDir, 'paper_workspace', 'resource_inventory.tex');

    let context = '';
    if (existsSync(resultsPath)) {
      context += `\n\n## Formalized Results\n${readFileSync(resultsPath, 'utf-8')}`;
    }
    if (existsSync(resourcePath)) {
      context += `\n\n## Resource Inventory\n${readFileSync(resourcePath, 'utf-8')}`;
    }

    // Inject instruction to create narrative brief
    const narrativePrompt = getNarrativeVoicePrompt();
    await steering.inject(
      'BEFORE starting the writeup, create paper_workspace/narrative_brief.md using the following guidance:\n\n' +
        narrativePrompt +
        '\n\nContext from prior stages:' +
        context +
        '\n\nAfter writing narrative_brief.md, proceed with the writeup. Read narrative_brief.md and author_style_guide.md before writing any prose.',
      'm',
    );

    api.sendMessage('*Narrative voice guidance injected. Writeup will proceed with voice guidance.*');
  } catch (err: any) {
    api.log?.('warn', `Narrative voice injection failed: ${err.message}`);
    // Non-fatal: writeup continues without narrative brief
  }
}

/**
 * Review Escalation Hook — detect critically low review scores
 * and trigger full pipeline restart via steering.
 *
 * Score <= 3 → full restart from persona_council (fundamental issues)
 * Score 4-5 → consortium's validation_gate handles looping to writeup
 * Score >= 6 → pass (handled by consortium)
 */
async function checkReviewEscalation(run: RunHandle, api: any): Promise<void> {
  // Only check after reviewer_agent
  if (run.currentStage !== 'reviewer_agent') return;
  if (!run.workspaceDir) return;

  const verdict = readReviewVerdict(run.workspaceDir);
  if (!verdict) return;

  // Score <= 3: fundamental issues, need full restart
  if (verdict.score <= 3) {
    api.sendMessage(
      `**Review Score: ${verdict.score}/10** (critically low)\n` +
        `**AI Voice Risk:** ${verdict.ai_voice_risk}\n` +
        `**Hard Blockers:** ${verdict.hard_blockers.join(', ') || 'none'}\n` +
        `**Fix Type:** ${verdict.fix_type}\n\n` +
        '*Triggering full pipeline restart from persona debate...*',
    );

    try {
      const steering = new SteeringClient(run.steeringPort);
      const ready = await steering.waitForReady(10000);
      if (ready) {
        await steering.pause();
        await steering.inject(
          `The reviewer gave a critically low score of ${verdict.score}/10. ` +
            `Hard blockers: ${verdict.hard_blockers.join(', ') || 'none'}. ` +
            `AI voice risk: ${verdict.ai_voice_risk}. ` +
            `This indicates fundamental issues with the research direction. ` +
            `Restart from persona_council with a revised approach that addresses: ` +
            verdict.summary,
          'm',
        );
      }
    } catch (err: any) {
      api.log?.('warn', `Review escalation steering failed: ${err.message}`);
    }
  } else if (verdict.score >= 6) {
    api.sendMessage(
      `**Review Score: ${verdict.score}/10** | **AI Voice Risk:** ${verdict.ai_voice_risk}`,
    );
  }
}

/**
 * Check for pipeline completion or failure and send final message.
 */
function checkCompletion(run: RunHandle, api: any): void {
  if (run.status !== 'completed' && run.status !== 'failed' && run.status !== 'stopped') {
    return;
  }

  if (completionSent.has(run.id)) return;
  completionSent.add(run.id);

  if (run.status === 'completed') {
    const message = composeCompletionMessage(run);
    api.sendMessage(message);

    // Deliver paper file if available
    const paperPath = findPaperFile(run.workspaceDir);
    if (paperPath) {
      try {
        api.sendFile?.(paperPath);
      } catch {
        api.sendMessage(`Paper available at: \`${paperPath}\``);
      }
    }
  } else {
    const message = composeFailureMessage(run);
    api.sendMessage(message);
  }

  // Remove from active runs after a delay
  setTimeout(() => {
    activeRuns.delete(run.id);
  }, 60_000);
}
