# pAI/MSc-openclaw

Native OpenClaw plugin for the [pAI/MSc](https://github.com/PoggioAI/PoggioAI_MSc) autonomous research pipeline. Transforms a research hypothesis into a conference-grade manuscript with a single command — zero config, zero human steers required.

```
================================================================
  pAI/MSc-openclaw — Autonomous Research Pipeline
================================================================

  Thanks from the PoggioAI Team for using this tool!

  Contact us:
    Discord: https://discord.gg/Pz7spPPY
    Email:   pierb@mit.edu

  Please acknowledge PoggioAI in your papers and cite our
  technical report if you use this tool:
    https://poggioai.github.io/papers/poggioai-msc-v0.pdf

================================================================
```

---

## Quick Start

```
/pai-msc "Investigate whether batch normalization implicitly regularizes the spectral norm of weight matrices in shallow ReLU networks"
```

That's it. The plugin:
1. Auto-installs the pAI/MSc Python backend on first use
2. Passes your existing OpenClaw API keys (no separate `.env` needed)
3. Creates an isolated run workspace with all inputs in `initial_context/`
4. Prompts you for reference files (papers, datasets) via Telegram/interface
5. Injects 29 backtested quality prompts + a 647-line author style guide
6. Runs the full 22-agent pipeline with quality-maximizing defaults
7. Streams progress updates to your chat as stages complete
8. Delivers the finished paper (PDF or markdown) back to you

---

## What's In This Repository

```
├── openclaw.plugin.json              # Plugin manifest — name, version, config schema
├── package.json                      # TypeScript package (build with npm run build)
├── tsconfig.json                     # TypeScript compiler config
├── README.md                         # This file
│
├── src/                              # TypeScript source (3,000+ lines)
│   ├── index.ts                      # Entry point: definePluginEntry() — registers
│   │                                 #   4 commands, 4 tools, 1 background service,
│   │                                 #   and a shutdown hook
│   │
│   ├── commands/                     # User-facing slash commands
│   │   ├── research.ts               # /pai-msc "hypothesis" [flags] — the main entry
│   │   ├── pai-msc-status.ts         # /pai-msc-status — show current stage + budget
│   │   ├── pai-msc-stop.ts           # /pai-msc-stop — kill a running pipeline
│   │   └── pai-msc-list.ts           # /pai-msc-list — list all runs in this session
│   │
│   ├── tools/                        # Agent-callable tools (programmatic access)
│   │   ├── run-pipeline.ts           # pai-msc.runPipeline — start a run
│   │   ├── steer-pipeline.ts         # pai-msc.steerPipeline — inject instructions
│   │   ├── get-results.ts            # pai-msc.getResults — retrieve status + paper
│   │   └── approve-milestone.ts      # pai-msc.approveMilestone — gate responses
│   │
│   ├── services/                     # Core services
│   │   ├── workspace-manager.ts      # Creates per-run workspace with initial_context/,
│   │   │                             #   logs/, uploads/, docs/ dirs + vision.md.
│   │   │                             #   All run data isolated under
│   │   │                             #   ~/.openclaw/poggioai-msc/runs/
│   │   ├── upload-handler.ts         # Prompts user for reference files via Telegram/
│   │   │                             #   interface with 3-strategy fallback. Saves to
│   │   │                             #   initial_context/uploads/
│   │   ├── installer.ts              # Auto-install: clone repo → conda env → pip →
│   │   │                             #   patch prompts → preflight check → sentinel
│   │   ├── process-manager.ts        # Spawn Python subprocess with workspace-aware
│   │   │                             #   env. Logs to logs/stdout.log + stderr.log
│   │   ├── progress-poller.ts        # Background service: polls every 15s for stage
│   │   │                             #   changes, budget thresholds, completion/failure.
│   │   │                             #   Also handles the narrative voice hook and
│   │   │                             #   review score escalation.
│   │   └── quality-injector.ts       # Copies backtested prompts + style guide into
│   │                                 #   initial_context/ and paper_workspace/
│   │
│   ├── bridge/                       # Integration layer between plugin and Python backend
│   │   ├── env-passthrough.ts        # Reads API keys from OpenClaw env → writes .env
│   │   ├── config-writer.ts          # Generates .llm_config.yaml from preset + flags
│   │   ├── steering-client.ts        # HTTP client for live steering API
│   │   │                             #   (POST /interrupt, /instruction, GET /status)
│   │   └── result-reader.ts          # Reads run_summary.json, budget_state.json,
│   │                                 #   review_verdict.json, finds paper file
│   │
│   ├── defaults/                     # Configuration defaults
│   │   ├── quality-presets.ts        # QUALITY_MAX and QUALITY_FAST presets with all
│   │   │                             #   CLI flag values pre-configured
│   │   └── stage-names.ts            # 28 pipeline stage constants + human-readable
│   │                                 #   display names for progress messages
│   │
│   └── types/                        # TypeScript type definitions
│       ├── openclaw-api.ts           # OpenClawApi interface + runtime guards
│       ├── pipeline.ts               # RunHandle, PipelineOptions, StageEvent, RunSummary
│       ├── config.ts                 # PluginConfig interface + DEFAULT_CONFIG
│       ├── budget.ts                 # BudgetState, BudgetEntry, BUDGET_THRESHOLDS
│       └── steering.ts              # SteeringInstruction, SteeringStatus, ReviewVerdict
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
│   ├── state_template.json           # Pipeline state machine template
│   │
│   ├── docs/                         # 7 orchestration docs (from Claude skill)
│   │   ├── persona-council.md        # Vision seeding, debate escalation templates
│   │   ├── execution-protocol.md     # Multi-pass resume, validation checklists
│   │   ├── explore-mode.md           # Explore cycle escalation, convergence rules
│   │   ├── pre-writeup-council.md    # Phase 7b context injection
│   │   ├── persona-post-review.md    # Phase 11 veto rules, concern archival
│   │   ├── review-cycle.md           # Human review cycle handling
│   │   └── token-logging.md          # Per-phase token logging script
│   │
│   └── prompts/                      # 29 backtested agent prompts (25 core + 4 explore)
│       ├── 01-persona-practical.md   # Practical Compass persona
│       ├── 02-persona-rigor.md       # Rigor & Novelty persona
│       ├── 03-persona-narrative.md   # Narrative Architect persona
│       ├── 04-persona-synthesis.md   # Synthesis coordinator (min 3 debate rounds)
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
│       ├── 25-narrative-voice.md     # Pre-writeup tone/voice guidance
│       ├── 30-math-explorer.md      # Explore mode: iterative math investigation
│       ├── 31-experiment-explorer.md # Explore mode: iterative experiment investigation
│       ├── 32-cross-pollinator.md   # Explore mode: theory↔experiment bridge
│       └── 33-explore-evaluator.md  # Explore mode: convergence check
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

When you run `/pai-msc "hypothesis"`, the plugin orchestrates a 22-agent pipeline:

```
/pai-msc "hypothesis"
  │
  │ ── Plugin Layer ──────────────────────────────────────────────
  │
  ├─ 1. Auto-install pAI/MSc Python backend (first time only)
  ├─ 2. Create isolated run workspace under ~/.openclaw/poggioai-msc/runs/
  ├─ 3. Copy prompts + style guide → initial_context/
  ├─ 4. Write task.txt + pipeline_options.json → initial_context/
  ├─ 5. Prompt user for reference files → initial_context/uploads/
  ├─ 6. Write .env + .llm_config.yaml (per-run, not shared)
  ├─ 7. Spawn: python launch_multiagent.py --resume {workspace} [flags]
  │
  │ ── pAI/MSc Pipeline (Python/LangGraph) ──────────────────────
  │
  ├─ Phase 1: Persona Debate (3-5 rounds)
  │     3 personas (Practical, Rigor, Narrative) debate in escalating
  │     rounds. Each round must be HARDER than the last. Minimum 3
  │     rounds; extends to 5 if any persona still rejects. Synthesis
  │     produces a research proposal.
  │
  ├─ Phase 2: Adversarial Literature Review (2-5 passes)
  │     Assumes your claims are already known. Searches ICML, NeurIPS,
  │     JMLR, COLT, zbMATH, MathOverflow. Assigns per-claim status:
  │     OPEN / PARTIAL / KNOWN / EQUIVALENT_KNOWN.
  │
  ├─ [GATE: Feasibility] ── blocks if core hypothesis marked KNOWN
  │
  ├─ Phase 3: Brainstorm (2-5 passes, 3+ approaches with risk profiles)
  ├─ Phase 4: Formalize Goals + Track Decomposition (2-5 passes)
  ├─ Phase 5: Research Plan (2-3 passes)
  │
  ├─ [PARALLEL TRACKS] ─────────────────────────────────────────
  │   ├─ Theory Track (math agents enabled by default):
  │   │   Math Lit → Proposer → Prover → Adversarial Verifier
  │   │   (each phase: 2+ passes, unbounded for proofs)
  │   └─ Experiment Track:
  │       Design → Execute → Adversarial Verification
  │       (each phase: 2+ passes, unbounded for experiments)
  │
  ├─ Phase 6: Track Merge (2-3 passes) + Completion Check
  │     3-way routing: COMPLETE (≥80%) → proceed
  │                    INCOMPLETE (50-80%) → retry goals (max 3)
  │                    RETHINK (<50%) → restart brainstorm (max 3)
  │
  ├─ [GATE: Duality Check] ── theory-experiment consistency
  │
  ├─ Phase 7: Resource Preparation (figures, tables, bib)
  │
  ├─ Phase 7b: Pre-Writeup Council (2 advisory debate rounds)
  │     Personas re-evaluate formalized results before writing.
  │
  ├─ [HOOK: Narrative Voice] ── plugin injects tone/voice guidance
  │     via automated steering before writeup starts
  │
  ├─ Phase 8: 12-Pass Writeup
  │     Passes 1-6: Draft (plan → related work → sections → abstract)
  │     Passes 7-12: Review cycle (re-read → revise → recompile)
  │     Reads author_style_guide.md + narrative_brief.md before writing.
  │
  ├─ Phase 9: Proofreading + AI-Voice Detection (2-5 passes)
  ├─ Phase 10: Adversarial Review (hard blockers B1-B5)
  │
  ├─ [GATE: Validation] ── escalating failure handling:
  │     Score ≤ 3 → full restart from persona debate
  │     Score 4-5 (1st fail) → rewrite
  │     Score 4-5 (2nd fail) → full restart
  │     Score ≥ 7 → pass (max-quality preset)
  │
  └─ Phase 11: Post-Review Persona Council (2 debate rounds)
  │     Narrative Architect has 1 veto over the writeup.
  │     If all accept → DONE
  │     If Narrative rejects (1st time) → rewrite loop
  │     If Narrative rejects (2nd time) → finalize with concerns saved
  │
  │ ── Plugin Layer ──────────────────────────────────────────────
  │
  ├─ Progress Poller sends updates to your chat throughout
  ├─ Paper (PDF/LaTeX/markdown) delivered to your channel
  └─ Cost + duration + review score summary
```

### Explore Mode

When launched with `--explore`, the pipeline runs **2-5 exploration cycles** before a **final standard cycle**:

```
Exploration Cycles (2-5x):
  Phases 1-6 only (Persona → Track Merge)
  Uses special explore prompts (30-33) instead of standard agents:
    - Math Explorer: iterative mathematical investigation
    - Experiment Explorer: iterative experimental investigation
    - Cross-Pollinator: bridges theory↔experiment findings
    - Explore Evaluator: checks convergence across cycles

  Exit rules:
    Cycle 1: always continue to cycle 2
    Cycles 2-4: honor evaluator's convergence verdict
    Cycle 5: force convergence regardless

Final Standard Cycle:
  Full pipeline (Phases 1-11) using standard prompts
  Inherits all context from exploration cycles
```

Explore mode is useful for open-ended research questions where the hypothesis space is large and iterative investigation yields better results than a single pass.

### Per-Phase Pass Limits

Each phase has enforced minimum/maximum passes. Unbounded phases (marked `∞`) run until the agent is satisfied or the budget is hit.

| Phase | Min | Max | Notes |
|-------|-----|-----|-------|
| Persona Council | 1 | 1 | Single debate session (3-5 rounds internally) |
| Literature Review | 2 | 5 | Adversarial novelty check |
| Brainstorm | 2 | 5 | Divergent → convergent → dependency |
| Formalize Goals | 2 | 5 | + track decomposition |
| Research Plan | 2 | 3 | |
| Math Literature | 2 | ∞ | Unbounded for completeness |
| Math Proposer | 2 | ∞ | Claim graph construction |
| Math Prover | 2 | ∞ | With checkpoint/resume |
| Math Verifier | 2 | ∞ | Adversarial + numerical |
| Experiment Design | 2 | 5 | |
| Experimentation | 2 | ∞ | Unbounded for execution |
| Experiment Verify | 2 | ∞ | Cross-seed stability |
| Track Merge | 2 | 3 | |
| Verify Completion | 1 | 1 | 3-way routing gate |
| Formalize Results | 2 | 5 | |
| Duality Check | 1 | 1 | Theory-experiment gate |
| Resource Prep | 2 | 3 | |
| Writeup | 12 | 12 | Fixed 12-pass (6 draft + 6 review) |
| Proofreading | 2 | 5 | AI-voice detection |
| Reviewer | 1 | 1 | Score + hard blockers |
| Post-Review Council | 1 | 1 | Narrative veto |

The `fast` preset reduces all minimums to 1 and caps maximums lower (e.g., writeup: 3, literature: 3).

### Human Review Cycles

After the pipeline completes a full cycle, you can provide feedback for iterative improvement:

1. The plugin delivers the paper and review summary
2. You place review notes in a `review_N/` folder in the workspace (or provide inline text)
3. Run `/pai-msc --resume /path/to/workspace "original hypothesis"` to start a new cycle
4. The pipeline archives the previous cycle to `cycle_N/` and injects your feedback into the persona council prompts
5. A full cycle restarts from Phase 1 with your review context

This enables human-in-the-loop refinement while preserving all prior work.

### Progress Updates

While the pipeline runs, you'll see messages like:

```
[1/24] Persona Debate (5 escalating rounds) (0s)
[2/24] Literature Review (adversarial novelty check) (3m | $2.15)
[5/24] Formalizing Research Goals (8m | $5.40)
Budget 25%: $75.00 / $300.00
[15/24] Running Experiments (45m | $42.18)
Budget 50%: $150.00 / $300.00
[22/24] Writing Paper (12-pass cycle) (1h 30m | $98.32)
Injecting narrative voice guidance before writeup...
[23/24] Proofreading & AI-Voice Check (2h 05m | $112.15)
[24/24] Adversarial Peer Review (2h 12m | $117.30)
Review Score: 8/10 | AI Voice Risk: LOW

Research Complete!
Task: "Investigate whether batch normalization..."
Model: claude-opus-4-6 | Duration: 3h 45m
Cost: $142.30 / $300.00
Review Score: 8/10 | AI Voice Risk: LOW
Stages: 24/24 completed
Workspace: ~/.openclaw/poggioai-msc/runs/run-2026-03-29T15-30-22-a1b2/
Paper: ~/.openclaw/poggioai-msc/runs/run-2026-03-29T15-30-22-a1b2/paper_workspace/final_paper.pdf
```

---

## Commands

### `/pai-msc "hypothesis" [flags]`

Start a new research pipeline run.

| Flag | Default | Description |
|------|---------|-------------|
| (positional) | required | Research hypothesis / task description |
| `--preset` | `max-quality` | Quality preset: `max-quality` or `fast` |
| `--model` | `claude-opus-4-6` | LLM model (any model supported by pAI/MSc) |
| `--budget` | `300` | Budget cap in USD |
| `--output` | `latex` | Output format: `latex` or `markdown` |
| `--mode` | `local` | Deployment: `local` (CPU), `tinker` (GPU), `hpc` (SLURM) |
| `--math` / `--no-math` | `--math` | Enable/disable theory track |
| `--counsel` / `--no-counsel` | `--counsel` | Enable/disable multi-model debate |
| `--tree-search` | on (max-quality) | Enable parallel proof strategies |
| `--explore` | off | Enable explore mode (2-5 exploration cycles + 1 final paper cycle) |
| `--style-guide PATH` | bundled | Path to a custom author style guide |
| `--attach PATH` | — | Attach a reference file (repeatable). Saved to `initial_context/uploads/` |
| `--no-upload-prompt` | off | Skip the interactive file upload prompt |
| `--resume PATH` | — | Resume a prior run from its workspace |
| `--dry-run` | off | Validate config without making API calls |

**Examples:**

```bash
# Maximum quality (default) — Opus, LaTeX+PDF, counsel, math, tree search, 12-pass writeup
/pai-msc "Investigate whether batch normalization implicitly regularizes spectral norm"

# Quick draft — Sonnet, markdown, no counsel, $25 budget
/pai-msc --preset fast "quick investigation of learning rate warmup effects"

# Explore mode — 2-5 exploration cycles then 1 final paper cycle
/pai-msc --explore "Is there a universal scaling law for attention head pruning?"

# Custom model and budget
/pai-msc --model claude-sonnet-4-6 --budget 50 "effect of dropout on spectral gap"

# With custom style guide
/pai-msc --style-guide ~/my-style-guide.md "your hypothesis"

# Attach reference papers/datasets (repeatable)
/pai-msc --attach ~/papers/related-work.pdf --attach ~/data/dataset.csv "your hypothesis"

# Skip the upload prompt (for automation)
/pai-msc --no-upload-prompt "your hypothesis"

# Resume a failed run
/pai-msc --resume ~/.openclaw/poggioai-msc/runs/run-2026-03-29T15-30-22-a1b2 "original hypothesis"

# Dry run — validates config, shows what would run, costs nothing
/pai-msc --dry-run "test hypothesis"
```

### `/pai-msc-status [run-id]`

Show the current status of a running pipeline: stage, elapsed time, budget usage.

### `/pai-msc-stop [run-id]`

Stop a running pipeline. The workspace is preserved — you can resume later with `--resume`.

### `/pai-msc-list`

List all runs in the current session with status, cost, and duration.

---

## Quality Presets

### `max-quality` (default)

Everything turned to maximum. Matches the Claude skill's multi-pass execution protocol.

| Setting | Value |
|---------|-------|
| Model | `claude-opus-4-6` |
| Budget | $300 |
| Output | LaTeX + PDF |
| Math agents | Enabled |
| Counsel (multi-model debate) | Enabled |
| Tree search (parallel proofs) | Enabled |
| Persona debate rounds | 5 (escalating) |
| Pre-writeup council rounds | 2 |
| Post-review council rounds | 2 |
| Writeup passes | 12 (6 draft + 6 review) |
| Min passes per phase | 2 |
| Max ideation cycles | 2 |
| Counsel debate rounds | 5 |
| Followup max iterations | 5 |
| Min review score | 7/10 |
| PDF required | Yes |
| Paper artifact checks | Enforced |
| Editorial artifact checks | Enforced |
| **Expected cost** | **$100-300** |
| **Expected time** | **3-8 hours** |

### `fast`

| Setting | Value |
|---------|-------|
| Model | `claude-sonnet-4-6` |
| Budget | $25 |
| Output | Markdown |
| Math agents | Disabled |
| Counsel | Disabled |
| Tree search | Disabled |
| Persona debate rounds | 2 |
| Pre-writeup council rounds | 1 |
| Post-review council rounds | 1 |
| Writeup passes | 3 |
| Min passes per phase | 1 |
| Max ideation cycles | 1 |
| Min review score | 5/10 |
| PDF required | No |
| Paper artifact checks | Not enforced |
| **Expected cost** | **$5-15** |
| **Expected time** | **20-60 minutes** |

---

## Agent-Callable Tools

The plugin registers 4 tools that the OpenClaw agent can call programmatically (e.g., when the user says "research X for me" in natural language):

| Tool | Description |
|------|-------------|
| `pai-msc.runPipeline` | Start a pipeline run with structured parameters |
| `pai-msc.steerPipeline` | Inject instructions into a running pipeline |
| `pai-msc.getResults` | Get status, budget, review score, artifacts, paper path |
| `pai-msc.approveMilestone` | Respond to human-in-the-loop gates (approve/modify/abort) |

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
│   └── docs/                        # 7 orchestration docs (routing, protocols)
│   │   ├── related-work.pdf
│   │   └── dataset.csv
│   └── prompts/                     # 25 backtested prompts (archived)
│       ├── 01-persona-practical.md
│       └── ... (25 files)
├── vision.md                        # Immutable research vision (READ-ONLY after creation)
├── paper_workspace/                 # Pipeline outputs
│   ├── final_paper.pdf
│   ├── review_verdict.json
│   ├── author_style_guide.md        # Runtime copy
│   ├── skill_prompts/               # Runtime prompt copies
│   └── skill_docs/                  # Runtime orchestration doc copies
├── math_workspace/                  # Theory track outputs
├── experiment_workspace/            # Experiment outputs
├── cycle_0/, cycle_1/, ...          # Archived prior cycles (human review flow)
├── review_1/, review_2/, ...        # Human review feedback per cycle
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

The plugin ships a 647-line default style guide tailored for ML theory papers (`assets/author_style_guide_default.md`). It covers:

- **Non-negotiable principles** — one central intellectual spine, epistemic status per sentence, reader-first organization, compression, no global incoherence
- **Positive exemplars** — 5 detailed case studies from von Luxburg, Vershynin, Tropp, Bottou, and Peyton Jones with specific virtues to imitate
- **Global anti-patterns** — concrete failure modes at paper, section, sentence, and epistemic levels that make papers feel AI-generated
- **Abstract rules** — 120-180 words, no theorem refs, 5 specific tasks the abstract must accomplish
- **Related-work rules** — organize by ideas not authors, include judgment, avoid citation-led paragraphs
- **Concrete lints** — 23+ specific checks the writeup agent enforces
- **Epistemic lints** — "prove" only for proved results, "observe" only for experiments, "conjecture" for open questions
- **Case studies** — two detailed diagnoses of weak abstracts and related-work sections with fixed versions
- **Self-audit checklist** — 5-tier check (paper → abstract → related-work → epistemic → deletion)

Override with your own:

```bash
/pai-msc --style-guide /path/to/my-style-guide.md "hypothesis"
```

Your style guide is copied into `initial_context/author_style_guide.md`. If you provide one, the bundled default is still read for any topics your guide doesn't cover.

See `examples/custom-style-guide-example.md` for a template.

---

## Quality Improvements Over Base System

This plugin incorporates improvements developed through extensive backtesting of the Claude skill version:

| Improvement | What It Does |
|-------------|-------------|
| **29 refined prompts** | 25 core + 4 explore prompts, synced with the Claude skill source of truth. Persona prompts include paper-shaping authority, validation scope labeling, narrative preservation rules, vision alignment, and anti-retreat logic. |
| **Vision lock** | `vision.md` created at run start captures the researcher's original intent. Immutable after creation — all personas read it before evaluating to prevent scope drift. |
| **7 orchestration docs** | Context injection templates, routing rules, multi-pass resume protocol, validation checklists, and human review cycle handling — copied from Claude skill source of truth. |
| **Adversarial novelty falsification** | Literature review *assumes* claims are known, searches to disprove — not confirm |
| **AI-voice detection** | 9-category checklist in proofreading (repeated structure, "Furthermore" chains, formulaic hedging, etc.) + hard blocker B4 in review |
| **Hard blockers B1-B5** | Binary checks: missing research questions (B1), unsupported takeaways (B2), placeholders (B3), AI-sounding language (B4), untraced theory claims (B5). Any blocker → score capped at 4/10 |
| **Narrative voice phase** | Dedicated pre-writeup step that sets surprise markers, related-work framing, discussion blueprint, and anti-AI-voice rules. Injected via automated steering. |
| **Escalating review failure** | Score ≤ 3 → full pipeline restart. Score 4-5 → rewrite, then restart if still fails. No infinite rewriting loops. |
| **12-pass writeup** | 2 full edit cycles (6 draft passes + 6 review passes) with the style guide enforced throughout |
| **5-round persona debate** | Up to 5 escalating rounds. Each round must be harder. No single-pass rubber-stamping. |
| **Pre-writeup council** | 2 advisory rounds before writing to catch narrative/consistency issues early |
| **Post-review council** | 2 debate rounds after validation. Narrative Architect has 1 veto. |
| **Multi-pass execution** | Every phase runs 2+ passes minimum. Resume logic detects incomplete artifacts and refines. |
| **Tree search** | Parallel proof strategies for theory track (enabled by default in max-quality) |
| **Explore mode** | 2-5 exploration cycles with specialized prompts (math explorer, experiment explorer, cross-pollinator, evaluator) before a final standard cycle. For open-ended research questions. |
| **Per-phase pass limits** | 21 phases with enforced min/max passes. Theory/experiment phases are unbounded; gates are single-pass; writeup is fixed at 12. |
| **Human review cycles** | Iterative refinement: deliver paper → receive feedback in `review_N/` → archive to `cycle_N/` → restart with review context |
| **Per-run workspace isolation** | `.env`, config, logs all scoped to run directory. No concurrent run interference. |
| **initial_context/ archival** | All inputs (task, prompts, style guide, uploads) preserved for reproducibility |

---

## Configuration

Plugin configuration is set in your OpenClaw config file (`~/.openclaw/openclaw.json`):

```json
{
  "plugins": {
    "pai-msc-openclaw": {
      "enabled": true,
      "config": {
        "consortiumPath": "",
        "condaEnvName": "poggioai-msc",
        "defaultPreset": "max-quality",
        "defaultMode": "local",
        "defaultModel": "claude-opus-4-6",
        "defaultBudgetUsd": 300,
        "progressPollIntervalMs": 15000,
        "steeringBasePort": 5001,
        "uploadTimeoutMs": 60000,
        "agentTimeoutMs": 2700000,
        "enableExploreMode": false
      }
    }
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `consortiumPath` | `""` (auto-install) | Path to existing pAI/MSc installation. Leave empty to auto-install to `~/.openclaw/poggioai-msc/repo`. |
| `condaEnvName` | `"poggioai-msc"` | Conda environment name for the Python backend. |
| `defaultPreset` | `"max-quality"` | Default quality preset when no `--preset` flag given. |
| `defaultMode` | `"local"` | Deployment mode: `local` (CPU), `tinker` (GPU cluster), `hpc` (SLURM). |
| `defaultModel` | `"claude-opus-4-6"` | Default LLM model. |
| `defaultBudgetUsd` | `300` | Default budget cap per run. |
| `progressPollIntervalMs` | `15000` | How often to poll for progress (ms). |
| `steeringBasePort` | `5001` | Base port for the callback server. |
| `uploadTimeoutMs` | `60000` | Timeout for the file upload prompt in ms. Set to 0 to skip. |
| `agentTimeoutMs` | `2700000` | Agent timeout in ms (45 min). High value needed for multi-pass phases like 12-pass writeup. |
| `enableExploreMode` | `false` | Enable explore mode by default. Can also be enabled per-run with `--explore`. |

### API Keys

API keys are read from your OpenClaw environment — **no separate `.env` file needed**. The plugin passes these to the pAI/MSc backend:

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
| **git** | Required | For cloning the pAI/MSc repo |
| **conda** | Recommended | For Python env management (auto-detected) |
| **Python** >= 3.11 | Auto-installed | Via conda or system python |
| **pdflatex** | Optional | For LaTeX → PDF. Without it, output degrades to markdown. Install: `brew install --cask mactex-no-gui` |
| **bibtex** | Optional | For bibliography compilation |

Run `scripts/check-prereqs.sh` to verify everything:

```bash
bash scripts/check-prereqs.sh
```

---

## Installation

### From OpenClaw (when published)

```bash
openclaw plugins install pai-msc-openclaw
```

### Manual Installation

```bash
git clone https://github.com/PoggioAI/PoggioAI_MSc-openclaw.git
cd PoggioAI_MSc-openclaw
npm install
npm run build
```

Then either:
- Copy/symlink the directory to `~/.openclaw/plugins/pai-msc-openclaw`
- Or add the path to your OpenClaw config: `plugins.load.paths: ["/path/to/plugin"]`

Restart the OpenClaw gateway to load the plugin.

### Pre-installing the Python backend

The plugin auto-installs the pAI/MSc backend on first `/pai-msc` use. To pre-install manually:

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
/pai-msc --resume ~/.openclaw/poggioai-msc/runs/run-<timestamp>-<rand> "original hypothesis"
```

### Budget exceeded

The pipeline stops safely when the budget is hit. The workspace is preserved. You can resume with a higher budget:

```
/pai-msc --resume /path/to/workspace --budget 500 "hypothesis"
```

### Counsel mode disabled automatically

Counsel requires 3 provider keys (Anthropic + OpenAI + Google). If any are missing, the plugin falls back to single-model mode and warns you.

---

## Cost & Runtime Expectations

| Configuration | Cost | Runtime |
|---------------|------|---------|
| `--preset fast` | $5-15 | 20-60 min |
| `--preset max-quality` (default) | $100-300 | 3-8 hrs |

Costs depend on hypothesis complexity, number of revision loops triggered by quality gates, whether counsel mode runs (3x model calls per stage), and how many ideation cycles the validation gates trigger.

---

## Development

```bash
npm install
npm run watch    # Rebuild on changes
npm run build    # Production build
npm run clean    # Remove dist/
```

The TypeScript source is in `src/`. The `assets/` directory contains the quality artifacts that get injected into pipeline runs — edit these to tune prompt behavior or the style guide.

---

## License

MIT
