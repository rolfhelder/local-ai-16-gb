# Testing models and context windows

These tests answer different questions. A load/VRAM check is not a coding score; exact recall is not proof of useful long-context reasoning; scripted tool tests do not measure model intelligence.

## 1. Tool and harness conformance (no local-model inference)

On Windows, activate tools with `. ./scripts/Activate-Tools.ps1`, then run:

```powershell
pnpm test
pnpm eval:tools --profile=standard
pnpm eval:hooks
pnpm eval:guard
pnpm eval:browser
pnpm eval:web
pnpm eval:worktrees
pnpm eval:statusline
node evals/lsp-freshness.mjs
node evals/effort-runtime.mjs
```

The unit suite covers guard decisions, status formatting, request budgets, timing and recall graders. The scripted real-Pi tests exercise file operations, hooks, semantic LSP, destructive-command denial, browser isolation/form interaction, bounded web extraction/cache/error handling, worktrees and command behavior. Browser tests use a disposable local page. Baseline missing capabilities remain failures, not silently skipped passes. `evals/full-tool-suite.mjs` runs the implemented conformance entry points and records each exit code without stopping at the first failed suite.

The cleanup validation passed 74 unit checks, including POSIX launcher argument/dry-run checks on Windows; it does not establish actual macOS/Linux inference. Consult a new run for the current total. Some optional web searches have an observed parser failure. YouTube/ASR, native GUI tasks and image grounding do not yet have completed evals. Installed packages are not evidence that these tasks pass. GPU/eval scripts use native Windows tools; do not present them as validated macOS/Linux tests.

## 2. Choose a usable context window

First verify the GGUF hash and native context metadata. Quit other `pia`/Pi App sessions. Keep one model and one inference request active. Run a small repair before a large-context test:

```powershell
pnpm eval:coding --models=gemma --context=32768
pnpm eval:context-limits --models=gemma --contexts=131072 --pattern=words --reasoning-budget=2048 --output-tokens=8192 --no-refine
```

`evals/context-limits.mjs` loads the requested slot with automatic fit off, fills approximately 90% of it with synthetic records and five exact lookup values, then requests JSON-only recall with no tools. It samples total VRAM and parses llama.cpp timing logs. A capacity pass requires completed inference, not merely a successful load. Also record exact recall and the no-tools/JSON contract separately. The first context command above tests one size; pass a comma-separated list for a sweep. `--kv=q8_0` is a separately labeled cache condition, not a silent fallback.

For a new model start at the actual target window if requested, then step down until practical capacity passes. If setting a minimum (our Qwen3.8 minimum was 131072), stop downstream evals when that gate fails. Inspect prefill progress: an allocated slot that cannot ingest the prompt within the operational time budget is a throughput failure. Do not infer a native context ceiling or bad recall from a timeout. Record the exact bound: the older normal 128k tests used six minutes, 200k and the final Qwen3.8 trials used ten minutes. Cancelled trials are unscored.

Use VRAM headroom for the display and other applications. Record Windows shared-GPU-memory spill only if measured; it was not confirmed in the failed Qwen3.8 trials. Repeat with a smaller slot before deciding a model is unusable at all context sizes. A 200k launch default is an operating choice, not a claim of reliable 200k recall.

## 3. Coding under unrelated context

```powershell
pnpm eval:coding-context --run --models=gemma --context=204800
```

Three small repair projects cover CSV records, pagination contracts and asynchronous retries. Each runs clean and after exactly **100000 unrelated tokens** of field-journal material. The background is unrelated to the task/specification; system/tool context remains relevant. Context conditions alternate across cases. Public checks are preserved and hidden groups test edge cases. A full pass requires all checks, preserved fixtures and normal agent completion within six minutes. Correct code followed by a timeout or provider parser error is recorded separately from an incorrect repair.

Standard condition: reasoning enabled, 2048 thinking-token budget, 8192 total output cap, one slot, f16 KV. GPT-OSS uses its native 131072 window. The API-budget hook repairs an observed first-turn estimator problem; the initial GPT-OSS loaded result before that repair is invalid for the final quality comparison. Portable search dependencies were repaired before the GPT-OSS rerun, so the four-model run is not perfectly controlled.

Unrelated padding is a useful stress test, but it is not a substitute for realistic repository work or coherent long conversations. Repeat with several seeds/runs and larger real tasks before making a stable ranking.

## 4. Native `/effort` implementation task

The original task asked the model, through Pi App 0.7.6 / SDK 1.3.0, to create a native command. It started with clean context and the working solution withheld/backed up. Each model received one initial prompt and at most one diagnostic follow-up. The follow-up stayed in the same session. Candidates were never promoted into production.

Thirteen checks: registration, argument handling, no LLM call for command control, runtime session state, session-only defaults, current-level picker, transmitted budget, off semantics, native GPT-OSS effort mapping, invalid input, SDK-driven level changes, resource isolation and verification. Real Pi RPC processes with scripted HTTP providers inspected behavior and request payloads. Scores have **independent Round 1 and Round 2 columns**, with no half-point formula. The task specification and runner code remain under `evals/`; invoking the preparation/withholding helpers changes active source paths, so retain the hashed backup and restore the production files afterward. The guard tests alone do not authorize deleting session transcripts.

Gemma/Qwen/OmniCoder had 204800 capacity; GPT-OSS had 131072. An initial 32k Gemma setup run was excluded. Feedback was tailored to failures rather than identical across models. Guard false approvals from a PowerShell 5/7 parser mismatch were fixed after the four-model batch. Recorded host waits were excluded from the turn limit; OmniCoder required observer recovery. Consequently raw wall time is not a fair model-speed ranking. None of the four candidates completed all 13 checks.

## Metrics and artifacts

Record model/revision/quantization, runtime/SDK, GPU, native and requested context, KV type, reasoning/output caps, actual prompt occupancy, prompt TPS, generation TPS, sampled peak VRAM, timeouts, tool retries, interventions, provider errors and correctness. Generation TPS can include thinking and candidate self-tests; it excludes tool/prefill time. Cached input accumulated across turns is not unique context occupancy.

Raw reports/transcripts stay in ignored `.state/evals/` or `evaluation/`. Only the compact, reviewed [model summary](../results/models.json), [comparison](MODELS.md) and README chart are published. Do not automatically convert an assistant's success claim into a passing result.
