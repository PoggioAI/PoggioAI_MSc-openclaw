# PoggioAI/MSc OpenClaw Plugin

Native OpenClaw plugin for the [PoggioAI/MSc](https://github.com/PoggioAI/PoggioAI_MSc) autonomous research pipeline. Transforms a research hypothesis into a conference-grade manuscript with a single command — zero config, zero human steers required.

---

## Quick Start

```
/research "Investigate whether batch normalization implicitly regularizes the spectral norm of weight matrices in shallow ReLU networks"
```

That's it. The plugin:
1. Auto-installs the PoggioAI/MSc Python backend on first use
2. Passes your existing OpenClaw API keys (no separate `.env` needed)
3. Creates an isolated run workspace with all inputs in `initial_context/`
4. Prompts you for reference files (papers, datasets) via Telegram/interface
5. Injects 25 backtested quality prompts + a 647-line author style guide
6. Runs the full 22-agent pipeline with quality-maximizing defaults
7. Streams progress updates to your chat as stages complete
8. Delivers the finished paper (PDF or markdown) back to you

---

## What's In This Repository

```
plugin/
├── openclaw.plugin.json              # Plugin manifest — name, version, config schema
├── package.json                      # TypeScript package (build with npm run build)
├── tsconfig.json                     # TypeScript compiler config
├── README.md                        # This file
│
├── src/                              # TypeScript source (2,900+ lines)
│   ├── index.ts                      # Entry point: definePluginEntry() — registers
│   │                                 #   4 commands, 4 tools, 1 background service,
│   │                                 #   and a shutdown hook
│   │
│   ├── commands/                     # User-facing slash commands
│   │   ├── research.ts              # /research "hypothesis" [flags] — the main entry
│   │   ├── research-status.ts       # /research-status — show current stage + budget
│   │   ├── research-stop.ts         # /research-stop — kill a running pipeline
│   │   └── research-list.ts         # /research-list — list all runs in this session
│   │
│   ├── tools/                        # Agent-callable tools (programmatic access)
│   │   ├── run-pipeline.ts          # consortium.runPipeline — start a run
│   │   ├── steer-pipeline.ts        # consortium.steerPipeline — inject instructions
│   │   ├── get-results.ts           # consortium.getResults — retrieve status + paper
│   │   └── approve-milestone.ts     # consortium.approveMilestone — gate responses
│   │
│   ├── services/                     # Core services
│   │   ├── workspace-manager.ts     # Creates per-run workspace with initial_context/,
│   │   │                            #   logs/, uploads/ directories. All run data is
│   │   │                            #   isolated under ~/.openclaw/poggioai-msc/runs/
│   │   ├── upload-handler.ts        # Prompts user for reference files via Telegram/
│   │   │                            #   interface with 3-strategy fallback. Saves to
│   │   │                            #   initial_context/uploads/
│   │   ├── installer.ts             # Auto-install: clone repo → conda env → pip →
│   │   │                            #   patch prompts → preflight check → sentinel
│   │   ├── process-manager.ts       # Spawn Python subprocess with workspace-aware
│   │   │                            #   env. Logs to logs/stdout.log + stderr.log
│   │   ├── progress-poller.ts       # Background service: polls every 15s for stage
│   │   │                            #   changes, budget thresholds, completion/failure.
│   │   │                            #   Also handles the narrative voice hook and
│   │   │                            #   review score escalation.
│   │   └── quality-injector.ts      # Copies backtested prompts + style guide into
│   │                                #   initial_context/ and paper_workspace/
│   │
│   ├── bridge/                       # Integration layer between plugin and Python backend
│   │   ├── env-passthrough.ts       # Reads API keys from OpenClaw env → writes .env
│   │   ├── config-writer.ts         # Generates .llm_config.yaml from preset + flags
│   │   ├── steering-client.ts       # HTTP client for consortium's live steering API
│   │   │                            #   (POST /interrupt, /instruction, GET /status)
│   │   └── result-reader.ts         # Reads run_summary.json, budget_state.json,
│   │                                #   review_verdict.json, finds paper file
│   │
│   ├── defaults/                     # Configuration defaults
│   │   ├── quality-presets.ts       # QUALITY_MAX and QUALITY_FAST presets with all
│   │   │                            #   CLI flag values pre-configured
│   │   └── stage-names.ts           # 24 pipeline stage constants + human-readable
│   │                                #   display names for progress messages
│   │
│   └── types/                        # TypeScript type definitions
│       ├── openclaw-api.ts          # OpenClawApi interface + runtime guards
│       ├── pipeline.ts              # RunHandle, PipelineOptions, StageEvent, RunSummary
│       ├── config.ts                # PluginConfig interface + DEFAULT_CONFIG
│       ├── budget.ts                # BudgetState, BudgetEntry, BUDGET_THRESHOLDS
│       └── steering.ts             # SteeringInstruction, SteeringStatus, ReviewVerdict
│
├── assets/                           # Quality artifacts (ported from backtested Claude skill)
│   │
│   ├── author_style_guide_default.md # 647-line ML theory writing standard
│   │                                 # Contains: non-negotiable principles, anti-patterns
│   │                                 # (paper/section/sentence/epistemic), abstract rules
│   │                                 # (120-180 words, no theorem refs), related-work rules
│   │                                 # (organize by ideas not authors), concrete lints,
│   │                                 # epistemic lints, deletion pass, self-audit checklist,
│   │                                 # case studies with diagnosis + fix
│   │
│   ├── state_template.json           # Pipeline state machine template (32 fields)
│   │
│   └── prompts/                      # 25 backtested agent prompts
│       ├── 01-persona-practical.md   # Practical Compass persona
│       ├── 02-persona-rigor.md       # Rigor & Novelty persona
│       ├── 03-persona-narrative.md   # Narrative Architect persona
│       ├── 04-persona-synthesis.md   # Synthesis coordinator (min 2 debate rounds)
│       ├── 05-literature-review.md   # Adversarial novelty falsification
│       ├── 06-brainstorm.md          # 3-phase: divergent → convergent → dependency
│       ├── 07-formalize-goals.md     # Goal formalization + track decomposition
│       ├── 08-math-literature.md     # Theory-specific literature search
│       ├── 09-math-proposer.md       # Claim graph construction
│       ├── 10-math-prover.md         # Proof construction with technique library
│       ├── 11-math-verifier.md       # Adversarial proof auditor + numerical checks
│       ├── 12-experiment-design.md   # Experiment design with anti-hallucination
│       ├── 13-experimentation.md     # Experiment execution
│       ├── 14-experiment-verify.md   # Cross-seed stability, verdict annotation
│       ├── 15-formalize-results.md   # Conservative results synthesis
│       ├── 16-duality-check.md       # Dual-lens: actionability + soundness (>= 6/10)
│       ├── 17-resource-prep.md       # Figures, tables, bibliography
│       ├── 18-writeup.md             # 260-line writeup: 12 passes, 2 full edit cycles
│       ├── 19-proofreading.md        # AI-voice detection checklist (9 categories)
│       ├── 20-reviewer.md            # Hard blockers B1-B5, AI voice risk assessment
│       ├── 21-research-plan-writeup.md
│       ├── 22-track-merge.md         # Theory-experiment unified summary
│       ├── 23-verify-completion.md   # 3-way routing: COMPLETE/INCOMPLETE/RETHINK
│       ├── 24-followup-lit-review.md # Gap-specific targeted follow-up
│       └── 25-narrative-voice.md     # Pre-writeup tone/voice guidance
│
├── scripts/
│   ├── install-consortium.sh         # Manual installer (normally auto-runs)
│   └── check-prereqs.sh             # Verify conda, python, pdflatex, API keys
│
└── examples/
    ├── quickstart-task.txt           # Example research hypothesis
    └── custom-style-guide-example.md # How to write a custom style guide
```

---

## How It Works

### The Pipeline

When you run `/research "hypothesis"`, the plugin orchestrates a 22-agent pipeline:

```
/research "hypothesis"
  │
  │ ── Plugin Layer ──────────────────────────────────────────────
  │
  ├─ 1. Auto-install consortium Python backend (first time only)
  ├─ 2. Create isolated run workspace under ~/.openclaw/poggioai-msc/runs/
  ├─ 3. Copy prompts + style guide → initial_context/
  ├─ 4. Write task.txt + pipeline_options.json → initial_context/
  ├─ 5. Prompt user for reference files → initial_context/uploads/
  ├─ 6. Write .env + .llm_config.yaml (per-run, not shared)
  ├─ 7. Spawn: python launch_multiagent.py --resume {workspace} [flags]
  │
  │ ── Consortium Pipeline (Python/LangGraph) ───────────────────
  │
  ├─ Phase 1: Persona Debate
  │     3 personas (Practical, Rigor, Narrative) debate for 3 rounds.
  │     Each round must be HARDER than the last. Synthesis produces
  │     a research proposal.
  │
  ├─ Phase 2: Adversarial Literature Review
  │     Assumes your claims are already known. Searches ICML, NeurIPS,
  │     JMLR, COLT, zbMATH, MathOverflow. Assigns per-claim status:
  │     OPEN / PARTIAL / KNOWN / EQUIVALENT_KNOWN.
  │
  ├─ [GATE: Feasibility] ── blocks if core hypothesis marked KNOWN
  │
  ├─ Phase 3: Brainstorm (3+ approaches with risk profiles)
  ├─ Phase 4: Formalize Goals + Track Decomposition
  ├─ Phase 5: Research Plan
  │
  ├─ [PARALLEL TRACKS] ─────────────────────────────────────────
  │   ├─ Theory Track (if --math):
  │   │   Math Lit → Proposer → Prover → Adversarial Verifier
  │   └─ Experiment Track:
  │       Design → Execute → Adversarial Verification
  │
  ├─ Phase 6: Track Merge + Completion Check
  │     3-way routing: COMPLETE (≥80%) → proceed
  │                    INCOMPLETE (50-80%) → retry goals (max 3)
  │                    RETHINK (<50%) → restart brainstorm (max 3)
  │
  ├─ [GATE: Duality Check] ── theory-experiment consistency
  │
  ├─ Phase 7: Resource Preparation (figures, tables, bib)
  │
  ├─ [HOOK: Narrative Voice] ── plugin injects tone/voice guidance
  │     via automated steering before writeup starts
  │
  ├─ Phase 8: 12-Pass Writeup
  │     Passes 1-6: Draft (plan → related work → sections → abstract)
  │     Passes 7-12: Review cycle (re-read → revise → recompile)
  │     Reads author_style_guide.md + narrative_brief.md before writing.
  │
  ├─ Phase 9: Proofreading + AI-Voice Detection
  ├─ Phase 10: Adversarial Review (hard blockers B1-B5)
  │
  ├─ [GATE: Validation] ── escalating failure handling:
  │     Score ≤ 3 → full restart from persona debate
  │     Score 4-5 (1st fail) → rewrite
  │     Score 4-5 (2nd fail) → full restart
  │     Score ≥ 6 → pass
  │
  └─ Phase 11: Post-Review Persona Council (Narrative has 1 veto)
  │
  │ ── Plugin Layer ──────────────────────────────────────────────
  │
  ├─ Progress Poller sends updates to your chat throughout
  ├─ Paper (PDF/LaTeX/markdown) delivered to your channel
  └─ Cost + duration + review score summary
```

### Progress Updates

While the pipeline runs, you'll see messages like:

```
[1/24] Persona Debate (3 perspectives) (0s)
[2/24] Literature Review (adversarial novelty check) (3m | $2.15)
[5/24] Formalizing Research Goals (8m | $5.40)
Budget 25%: $37.50 / $150.00
[15/24] Running Experiments (45m | $42.18)
Budget 50%: $75.00 / $150.00
[22/24] Writing Paper (12-pass cycle) (1h 30m | $68.32)
Injecting narrative voice guidance before writeup...
[23/24] Proofreading & AI-Voice Check (2h 05m | $82.15)
[24/24] Adversarial Peer Review (2h 12m | $87.30)
Review Score: 7/10 | AI Voice Risk: LOW

Research Complete!
Task: "Investigate whether batch normalization..."
Model: claude-opus-4-6 | Duration: 2h 15m
Cost: $87.32 / $150.00
Review Score: 7/10 | AI Voice Risk: LOW
Stages: 24/24 completed
Workspace: ~/.openclaw/poggioai-msc/runs/run-2026-03-29T15-30-22-a1b2/
Paper: ~/.openclaw/poggioai-msc/runs/run-2026-03-29T15-30-22-a1b2/paper_workspace/final_paper.pdf
```

---

## Commands

### `/research "hypothesis" [flags]`

Start a new research pipeline run.

| Flag | Default | Description |
|------|---------|-------------|
| (positional) | required | Research hypothesis / task description |
| `--preset` | `max-quality` | Quality preset: `max-quality` or `fast` |
| `--model` | `claude-opus-4-6` | LLM model (any model supported by consortium) |
| `--budget` | `150` | Budget cap in USD |
| `--output` | `latex` | Output format: `latex` or `markdown` |
| `--mode` | `local` | Deployment: `local` (CPU), `tinker` (GPU), `hpc` (SLURM) |
| `--math` / `--no-math` | `--math` | Enable/disable theory track |
| `--counsel` / `--no-counsel` | `--counsel` | Enable/disable multi-model debate |
| `--tree-search` | off | Enable parallel proof strategies |
| `--style-guide PATH` | bundled | Path to a custom author style guide |
| `--attach PATH` | — | Attach a reference file (repeatable). Saved to `initial_context/uploads/` |
| `--no-upload-prompt` | off | Skip the interactive file upload prompt |
| `--resume PATH` | — | Resume a prior run from its workspace |
| `--dry-run` | off | Validate config without making API calls |

**Examples:**

```bash
# Maximum quality (default) — Opus, LaTeX+PDF, counsel, math
/research "Investigate whether batch normalization implicitly regularizes spectral norm"

# Quick draft — Sonnet, markdown, no counsel, $25 budget
/research --preset fast "quick investigation of learning rate warmup effects"

# Custom model and budget
/research --model claude-sonnet-4-6 --budget 50 "effect of dropout on spectral gap"

# With custom style guide
/research --style-guide ~/my-style-guide.md "your hypothesis"

# Attach reference papers/datasets (repeatable)
/research --attach ~/papers/related-work.pdf --attach ~/data/dataset.csv "your hypothesis"

# Skip the upload prompt (for automation)
/research --no-upload-prompt "your hypothesis"

# Resume a failed run
/research --resume ~/.openclaw/poggioai-msc/runs/run-2026-03-29T15-30-22-a1b2 "original hypothesis"

# Dry run — validates config, shows what would run, costs nothing
/research --dry-run "test hypothesis"
```

### `/research-status [run-id]`

Show the current status of a running pipeline: stage, elapsed time, budget usage.

### `/research-stop [run-id]`

Stop a running pipeline. The workspace is preserved — you can resume later with `--resume`.

### `/research-list`

List all runs in the current session with status, cost, and duration.

---

## Quality Presets

### `max-quality` (default)

| Setting | Value |
|---------|-------|
| Model | `claude-opus-4-6` |
| Budget | $150 |
| Output | LaTeX + PDF |
| Math agents | Enabled |
| Counsel (multi-model debate) | Enabled |
| Persona debate rounds | 3 |
| Min review score | 6/10 |
| PDF required | Yes |
| Paper artifact checks | Enforced |
| Writeup revision loops | Up to 3 |
| **Expected cost** | **$50-200** |
| **Expected time** | **2-5 hours** |

### `fast`

| Setting | Value |
|---------|-------|
| Model | `claude-sonnet-4-6` |
| Budget | $25 |
| Output | Markdown |
| Math agents | Disabled |
| Counsel | Disabled |
| Persona debate rounds | 2 |
| Min review score | 5/10 |
| PDF required | No |
| Paper artifact checks | Not enforced |
| Writeup revision loops | Up to 2 |
| **Expected cost** | **$5-15** |
| **Expected time** | **20-60 minutes** |

---

## Agent-Callable Tools

The plugin registers 4 tools that the OpenClaw agent can call programmatically (e.g., when the user says "research X for me" in natural language):

| Tool | Description |
|------|-------------|
| `consortium.runPipeline` | Start a pipeline run with structured parameters |
| `consortium.steerPipeline` | Inject instructions into a running pipeline |
| `consortium.getResults` | Get status, budget, review score, artifacts, paper path |
| `consortium.approveMilestone` | Respond to human-in-the-loop gates (approve/modify/abort) |

---

## Workspace & File Uploads

### Per-Run Workspace

Every pipeline run gets its own isolated workspace under `~/.openclaw/poggioai-msc/runs/`:

```
~/.openclaw/poggioai-msc/runs/run-2026-03-29T15-30-22-a1b2/
├── initial_context/                 # All inputs archived here
│   ├── task.txt                     # Your research hypothesis
│   ├── pipeline_options.json        # Resolved config snapshot
│   ├── author_style_guide.md        # Style guide used
│   ├── state_template.json          # Initial state machine
│   ├── uploads/                     # Your reference files
│   │   ├── related-work.pdf
│   │   └── dataset.csv
│   └── prompts/                     # 25 backtested prompts (archived)
│       ├── 01-persona-practical.md
│       └── ... (25 files)
├── paper_workspace/                 # Pipeline outputs
│   ├── final_paper.pdf
│   ├── review_verdict.json
│   ├── author_style_guide.md        # Runtime copy
│   └── skill_prompts/               # Runtime copies
├── math_workspace/                  # Theory track outputs
├── experiment_workspace/            # Experiment outputs
├── .env                             # API keys for this run
├── .llm_config.yaml                 # Config for this run
├── budget_state.json                # Cost tracking
├── state.json                       # Pipeline state
└── logs/
    ├── stdout.log                   # Full subprocess output
    └── stderr.log                   # Error output
```

This means:
- **No shared state** — concurrent runs don't interfere with each other
- **Full reproducibility** — `initial_context/` has everything needed to understand what went in
- **Easy debugging** — `logs/` has the complete subprocess output
- **Clean resumption** — pass the workspace path to `--resume`

### File Uploads

Before starting the pipeline, the plugin prompts you to attach reference files:

```
Plugin: 📎 Attach reference files (papers, datasets, notes) or reply "no" to skip. (60s timeout)
You:    [uploads reference_paper.pdf, dataset.csv]
Plugin: ✅ 2 file(s) attached. Starting research pipeline...
```

Files are saved to `initial_context/uploads/` and the task description is amended to tell the pipeline where to find them.

**Three strategies** (automatic fallback):
1. Native upload dialog (if your OpenClaw version supports `requestUpload`)
2. Message prompt + wait for reply with attachments (Telegram, web, etc.)
3. Skip gracefully if the API doesn't support uploads

**CLI alternatives:**
- `--attach /path/to/file.pdf` — attach local files directly (repeatable)
- `--no-upload-prompt` — skip the upload question entirely

---

## Custom Author Style Guide

The plugin ships a 647-line default style guide tailored for ML theory papers. You can override it with your own:

```bash
/research --style-guide /path/to/my-style-guide.md "hypothesis"
```

Your style guide is copied into the workspace as `author_style_guide.md`. The writeup agent reads it before writing any prose.

See `examples/custom-style-guide-example.md` for a template showing what to include:
- Tone and voice preferences
- Target length and format
- Field-specific terminology rules
- Anti-patterns to avoid

The bundled default (`assets/author_style_guide_default.md`) covers:
- Non-negotiable principles (one central spine, epistemic status per sentence)
- Global anti-patterns that make papers feel AI-generated (paper/section/sentence/epistemic levels)
- Abstract rules (120-180 words, no theorem refs, no "contributions are N-fold")
- Related-work rules (organize by ideas not authors, include judgment)
- Concrete lints the writeup agent enforces
- Epistemic lints ("prove" only for proved results, "observe" only for experiments)
- Case studies diagnosing weak abstracts and related-work sections with fixes
- Self-audit checklist

---

## Quality Improvements Over Base System

This plugin incorporates improvements developed through extensive backtesting of the Claude skill version:

| Improvement | What It Does |
|-------------|-------------|
| **25 refined prompts** | Each agent prompt iteratively improved through real pipeline runs |
| **Adversarial novelty falsification** | Literature review *assumes* claims are known, searches to disprove — not confirm |
| **AI-voice detection** | 9-category checklist in proofreading (repeated structure, "Furthermore" chains, formulaic hedging, etc.) + hard blocker B4 in review |
| **Hard blockers B1-B5** | Binary checks: missing research questions (B1), unsupported takeaways (B2), placeholders (B3), AI-sounding language (B4), untraced theory claims (B5). Any blocker → score capped at 4/10 |
| **Narrative voice phase** | Dedicated pre-writeup step that sets surprise markers, related-work framing, discussion blueprint, and anti-AI-voice rules. Injected via automated steering. |
| **Escalating review failure** | Score ≤ 3 → full pipeline restart. Score 4-5 → rewrite, then restart if still fails. No infinite rewriting loops. |
| **12-pass writeup** | 2 full edit cycles (6 draft passes + 6 review passes) with the style guide enforced throughout |
| **3-round persona debate** | Minimum 3 rounds, each round must be harder. No single-pass rubber-stamping. |

---

## Configuration

Plugin configuration is set in your OpenClaw config file (`~/.openclaw/openclaw.json`):

```json
{
  "plugins": {
    "poggioai-msc": {
      "enabled": true,
      "config": {
        "consortiumPath": "",
        "condaEnvName": "poggioai-msc",
        "defaultPreset": "max-quality",
        "defaultMode": "local",
        "defaultModel": "claude-opus-4-6",
        "defaultBudgetUsd": 150,
        "progressPollIntervalMs": 15000,
        "steeringBasePort": 5001,
        "uploadTimeoutMs": 60000
      }
    }
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `consortiumPath` | `""` (auto-install) | Path to existing consortium installation. Leave empty to auto-install to `~/.openclaw/poggioai-msc/repo`. |
| `condaEnvName` | `"poggioai-msc"` | Conda environment name for the Python backend. |
| `defaultPreset` | `"max-quality"` | Default quality preset when no `--preset` flag given. |
| `defaultMode` | `"local"` | Deployment mode: `local` (CPU), `tinker` (GPU cluster), `hpc` (SLURM). |
| `defaultModel` | `"claude-opus-4-6"` | Default LLM model. |
| `defaultBudgetUsd` | `150` | Default budget cap per run. |
| `progressPollIntervalMs` | `15000` | How often to poll for progress (ms). |
| `steeringBasePort` | `5001` | Base port for the consortium callback server. |
| `uploadTimeoutMs` | `60000` | Timeout for the file upload prompt in ms. Set to 0 to skip. |

### API Keys

API keys are read from your OpenClaw environment — **no separate `.env` file needed**. The plugin passes these to the consortium backend:

| Key | Required | Purpose |
|-----|----------|---------|
| `ANTHROPIC_API_KEY` | Yes (minimum) | Claude models |
| `OPENAI_API_KEY` | For counsel mode | GPT models |
| `GOOGLE_API_KEY` | For counsel mode | Gemini models |
| `OPENROUTER_API_KEY` | Optional | OpenRouter access |
| `DEEPSEEK_API_KEY` | Optional | DeepSeek models |
| `XAI_API_KEY` | Optional | Grok models |
| `SERPER_API_KEY` | Optional | Web search for literature review |
| `TINKER_API_KEY` | For tinker mode | GPU cluster access |

**Counsel mode** requires all three: Anthropic + OpenAI + Google. If only some are configured, the plugin automatically disables counsel and warns you.

---

## Prerequisites

| Requirement | Status | Notes |
|-------------|--------|-------|
| **Node.js** >= 20 | Required | For the OpenClaw gateway |
| **git** | Required | For cloning the consortium repo |
| **conda** | Recommended | For Python env management (auto-detected) |
| **Python** >= 3.11 | Auto-installed | Via conda or system python |
| **pdflatex** | Optional | For LaTeX → PDF. Without it, output degrades to markdown. Install: `brew install --cask mactex-no-gui` |
| **bibtex** | Optional | For bibliography compilation |

Run `scripts/check-prereqs.sh` to verify everything:

```bash
cd plugin && bash scripts/check-prereqs.sh
```

---

## Installation

### From OpenClaw (when published)

```bash
openclaw plugins install poggioai-msc
```

### Manual Installation

```bash
git clone https://github.com/PoggioAI/PoggioAI-MSc-openclaw.git
cd PoggioAI-MSc-openclaw/plugin
npm install
npm run build
```

Then either:
- Copy/symlink the `plugin/` directory to `~/.openclaw/plugins/poggioai-msc`
- Or add the path to your OpenClaw config: `plugins.load.paths: ["/path/to/plugin"]`

Restart the OpenClaw gateway to load the plugin.

### Pre-installing the Python backend

The plugin auto-installs the consortium on first `/research` use. To pre-install manually:

```bash
bash scripts/install-consortium.sh
```

Or with a custom path and env name:

```bash
bash scripts/install-consortium.sh /path/to/install my-env-name
```

---

## Troubleshooting

### "No LLM API keys found"

Set at least `ANTHROPIC_API_KEY` in your OpenClaw configuration. The plugin reads keys from the gateway's environment.

### "Conda not found"

Install [Miniconda](https://docs.conda.io/en/latest/miniconda.html). The plugin falls back to `python3 -m venv` if conda is unavailable, but torch/CUDA support may be limited.

### "pdflatex not found"

LaTeX output degrades to markdown automatically. For PDF support: `brew install --cask mactex-no-gui` (macOS) or `apt install texlive-full` (Linux).

### Pipeline fails at a specific stage

Check the workspace for logs and partial artifacts:

```
~/.openclaw/poggioai-msc/runs/run-<timestamp>-<rand>/
├── logs/
│   ├── stdout.log           # Full subprocess output
│   └── stderr.log           # Error details
├── initial_context/         # All inputs that went in
├── paper_workspace/         # Partial paper artifacts
└── budget_state.json        # Cost so far
```

Resume from where it failed:

```
/research --resume ~/.openclaw/poggioai-msc/runs/run-<timestamp>-<rand> "original hypothesis"
```

### Budget exceeded

The pipeline stops safely when the budget is hit. The workspace is preserved. You can resume with a higher budget:

```
/research --resume /path/to/workspace --budget 300 "hypothesis"
```

### Counsel mode disabled automatically

Counsel requires 3 provider keys (Anthropic + OpenAI + Google). If any are missing, the plugin falls back to single-model mode and warns you.

---

## Cost & Runtime Expectations

| Configuration | Cost | Runtime |
|---------------|------|---------|
| `--preset fast` | $5-15 | 20-60 min |
| `--preset max-quality` (default) | $50-200 | 2-5 hrs |
| `--preset max-quality --tree-search` | $100-400 | 3-8 hrs |

Costs depend on hypothesis complexity, number of revision loops triggered by quality gates, and whether counsel mode runs (3x model calls per stage).

---

## Development

```bash
cd plugin
npm install
npm run watch    # Rebuild on changes
npm run build    # Production build
npm run clean    # Remove dist/
```

The plugin's TypeScript source is in `src/`. The `assets/` directory contains the quality artifacts that get injected into pipeline runs — edit these to tune prompt behavior or the style guide.

---

## License

MIT
