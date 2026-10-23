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

The cleanup validation passed 74 unit checks, including POSIX launcher argument/dry-run checks on Windows; it does not establish actual macOS/Linux inference. Consult a new run for the current total. Some optional web searches have an observed parser failure. Native GUI tasks and image grounding do not yet have completed evals. Installed packages are not evidence that these tasks pass. GPU/eval scripts use native Windows tools; do not present them as validated macOS/Linux tests.

## 2. Choose a usable context window

First verify the GGUF hash and native context metadata. Quit other `local-ai`/Pi App sessions. Keep one model and one inference request active. Run a small repair before a large-context test:

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

Raw private sessions stay ignored. The [complete sanitized observations](../results/observations.json) preserve every curated measured report from 2026-10-21/22: numeric timing samples, context sweeps, per-case grading, criteria, failed controls, module trials and setup investigations. Administrative queue files are excluded. Earlier diagnostic runs remain labeled separately from the final comparison; historical unit totals and states are not current defaults. The [compact model summary](../results/models.json) powers the overview. Do not convert an assistant's success claim into a pass.

## Recorded results and limits

### Practical verdict

**Gemma remains the default**: 5/6 full coding passes and the lowest sampled coding VRAM of these four on this laptop. GPT-OSS was fastest and passed the most hidden groups (35/36), but only 4/6 complete tasks and with little VRAM headroom. OmniCoder was a reasonable alternative (4/6); Qwen was weakest under unrelated padding (0/3). These are small exploratory samples, not a universal model ranking. The 200k default is a capacity preference, not a dependable recall guarantee.

### Coding comparison

“Full” requires functional correctness, preserved fixtures and normal completion. TPS below is the mean logged generation TPS across responses; thinking and model-driven self-tests may be included.

| Model | Clean full /3 | 100k padded full /3 | Functional /6 | Settled /6 | Hidden groups /36 | Clean / padded TPS | Mean seconds clean / padded | Peak total GPU MiB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Qwen | 2 | 0 | 3 | 4 | 29 | 71.1 / 49.1 | 156.2 / 196.3 | 14453 |
| Gemma | **3** | **2** | **5** | 5 | 32 | 53.2 / 44.6 | 136.0 / 252.4 | **13468** |
| OmniCoder | 2 | **2** | 4 | **6** | 34 | 71.6 / 49.0 | 143.5 / 105.4 | 14393 |
| GPT-OSS | **3** | 1 | **5** | 5 | **35** | **114.4 / 71.5** | **54.0** / 133.2 | 15809 |

Bold denotes a best value or tie per column where meaningful, not a composite score. Mean completion time includes failures and is not a clean speed ranking. Loaded output-token totals: Qwen 19658, Gemma 21304, OmniCoder 8191, GPT-OSS 15936; timeout recovery can omit an unfinished response and tokenizers differ.

| Repair / condition | Qwen | Gemma | OmniCoder | GPT-OSS |
|---|---|---|---|---|
| CSV / clean | Correct; timeout | Pass | Pass | Pass |
| CSV / padded | 1/6 hidden; timeout | 2/6 hidden; timeout | Pass | Correct; provider protocol error |
| Pagination / clean | Pass | Pass | 5/6 hidden | Pass |
| Pagination / padded | 5/6 hidden | Pass | 5/6 hidden | Pass |
| Async retries / clean | Pass | Pass | Pass | Pass |
| Async retries / padded | 5/6 hidden | Pass | Pass | 5/6 hidden |

One run per task/condition. Throttled downloads overlapped some runs, host repairs preceded GPT-OSS, and different native context ceilings limit direct comparability. Exact per-turn usage, timings, fixture/initial-failure checks and error strings are in observations.json, grouped by original report name. Earlier simple math-repair runs are retained there; they are smoke tests rather than additional independent hard coding tasks.

### Effort implementation: all four struggled

| Model | Round 1 /13 | Round 2 /13 | Generation TPS R1 / R2 | Peak total GPU MiB |
|---|---:|---:|---:|---:|
| Gemma | 2 | 6 | 49.2 / 41.6 | 13765 |
| Qwen | 0 | 7 | 44.3 / 45.1 | 14648 |
| OmniCoder | 0 | 0 | 55.0 / 50.6 | 15523 |
| GPT-OSS | 2 | 2 | 67.4 / 87.4 | 15919 |

A 7/13 score is still an incomplete command. None implemented reliable provider budgets, off handling or the complete SDK/client contract. Qwen's first candidate could not load because of syntax errors; OmniCoder never produced a loadable implementation; GPT-OSS encountered an undefined select helper and a stalled verifier. Gemma's first command registered without correctly changing effort. One diagnostic steering turn helped Gemma/Qwen but did not make either solution production-ready.

Each cell below is **Round 1 / Round 2**, with ✓ pass and × fail:

| Criterion | Gemma | Qwen | OmniCoder | GPT-OSS |
|---|---|---|---|---|
| registered | ✓ / ✓ | × / ✓ | × / × | ✓ / ✓ |
| arguments | × / × | × / × | × / × | × / × |
| no-llm-control-turn | ✓ / ✓ | × / ✓ | × / × | ✓ / ✓ |
| session-state | × / ✓ | × / ✓ | × / × | × / × |
| session-only | × / ✓ | × / ✓ | × / × | × / × |
| picker | × / × | × / × | × / × | × / × |
| provider-budget | × / × | × / × | × / × | × / × |
| off | × / × | × / × | × / × | × / × |
| native-effort | × / ✓ | × / ✓ | × / × | × / × |
| bad-input | × / × | × / ✓ | × / × | × / × |
| sdk-client | × / × | × / × | × / × | × / × |
| resource-isolation | × / ✓ | × / ✓ | × / × | × / × |
| verification | × / × | × / × | × / × | × / × |

The working production extension was restored after trials; none of these candidates replaced it. Scored Gemma/Qwen/OmniCoder sessions had 204800 capacity, GPT-OSS 131072, **clean initial context and no scored compactions**. This was not the 100k-padded coding task. The earlier 32k Gemma setup run is excluded. Tailored feedback, host approval waits and OmniCoder observer recovery mean raw wall time cannot rank model speed fairly.

### Context capacity versus recall

At 262144 capacity, Qwen processed 235658 prompt tokens (15390 MiB peak; 1725.51 prompt TPS, 26.53 generation TPS) and Gemma 235451 (14201 MiB; 944.27 / 37.18 TPS). **Both exact-recall scores were 0/5** in that matched reasoning-enabled run. Capacity was usable; retrieval was not reliable. Earlier word-pattern runs differed: Qwen passed at 196608 with 4096 output tokens; Gemma lost a required prefix at that size. Hex and word needles, reasoning flags and output limits must not be pooled into one accuracy claim.

OmniCoder returned all five exact values at 65536, 131072 and 204800 (~90% filled), with 9856 / 11968 / 14349 MiB peak and 58.33 / 47.03 / 38.87 generation TPS. GPT-OSS's native maximum is 131072: repaired default-budget 64k passed 5/5, while 128k violated the no-tool contract. Unrestricted 128k found values but broke the response contract; reference-budget 128k was also wrong. Allocation alone would have hidden these failures.

Historical sweep settings (all f16 KV; fit off, one slot, no context shift):

| CONTEXT-LIMITS run | Needle form | Reasoning / output allowance |
|---|---|---|
| #1 | Hex | Reasoning off; 256 output tokens |
| #2–3 | Hex | 512 thinking; 1024 total output |
| #4–6 | Words | 2048 thinking; 4096 total output |
| #7 | Words | 2048 thinking; 8192 total output |

Trials outside native metadata and load-only probes are historical diagnostics, not supported operating settings. All historical context trials are listed below. “Recall” is the recorded grader score out of five; a contract violation can zero it even when values appear in prose. See each source record for raw answers and contract checks. A dash means not recorded, not success. Protocol/settings are preserved per source run in observations.json.

| Source run | Model | Slot tokens | Actual prompt tokens | Inference complete | Recall /5 | Peak MiB | Prompt / generation TPS |
|---|---|---:|---:|---|---:|---:|---:|
| CONTEXT-LIMITS #1 | qwen | 131072 | 117704 | true | 5 | 11686 | 3116.86 / 47.82 |
| CONTEXT-LIMITS #1 | qwen | 196608 | 176688 | true | 0 | 14077 | 2511.14 / 39.88 |
| CONTEXT-LIMITS #1 | qwen | 262144 | 235668 | true | 0 | 15658 | 2207.97 / 35.22 |
| CONTEXT-LIMITS #1 | qwen | 327680 | — | — | — | 15971 | — / — |
| CONTEXT-LIMITS #1 | qwen | 294912 | — | — | — | 15453 | — / — |
| CONTEXT-LIMITS #1 | qwen | 278528 | — | — | — | 9595 | — / — |
| CONTEXT-LIMITS #1 | qwen | 270336 | — | — | — | 14661 | — / — |
| CONTEXT-LIMITS #1 | qwen | 262144 | 235670 | true | 0 | 14409 | 2264.79 / 35.25 |
| CONTEXT-LIMITS #1 | gemma | 32768 | 29027 | true | 5 | 8876 | 2712.76 / 50.29 |
| CONTEXT-LIMITS #1 | gemma | 65536 | 58517 | true | 0 | 9420 | 2366.9 / 49.17 |
| CONTEXT-LIMITS #1 | gemma | 98304 | 88009 | true | 0 | 9964 | 2041.12 / 45.57 |
| CONTEXT-LIMITS #1 | gemma | 131072 | 117500 | true | 0 | 10508 | 1792.08 / 44.22 |
| CONTEXT-LIMITS #1 | gemma | 196608 | 176487 | true | 3 | 12334 | 1403.74 / 40.03 |
| CONTEXT-LIMITS #1 | gemma | 262144 | 235467 | true | 0 | 13613 | 908.72 / 27.86 |
| CONTEXT-LIMITS #1 | gemma | 393216 | — | — | — | 15581 | — / — |
| CONTEXT-LIMITS #1 | gemma | 327680 | — | — | — | 14493 | — / — |
| CONTEXT-LIMITS #1 | gemma | 294912 | — | — | — | 13063 | — / — |
| CONTEXT-LIMITS #1 | gemma | 278528 | — | — | — | 13760 | — / — |
| CONTEXT-LIMITS #1 | gemma | 270336 | — | — | — | 12691 | — / — |
| CONTEXT-LIMITS #1 | gemma | 262144 | — | — | — | 1482 | — / — |
| CONTEXT-LIMITS #2 | qwen | 131072 | 117702 | true | 5 | 11793 | 3065.75 / 47.15 |
| CONTEXT-LIMITS #2 | qwen | 196608 | 176686 | true | 0 | 13945 | 2493.23 / 38.44 |
| CONTEXT-LIMITS #3 | gemma | 32768 | 29025 | true | 5 | 10484 | 2612.06 / 49.96 |
| CONTEXT-LIMITS #3 | gemma | 65536 | 58515 | true | 0 | 11591 | 2159.05 / 47.92 |
| CONTEXT-LIMITS #4 | qwen | 196608 | 176679 | true | 5 | 14201 | 2012.88 / 33.79 |
| CONTEXT-LIMITS #4 | qwen | 262144 | 235658 | true | 0 | 15801 | 2002.3 / 26.59 |
| CONTEXT-LIMITS #5 | gemma | 65536 | 58507 | true | 5 | 10588 | 1803.31 / 37.86 |
| CONTEXT-LIMITS #5 | gemma | 131072 | 117490 | true | 5 | 12194 | 1476.43 / 43.33 |
| CONTEXT-LIMITS #6 | gemma | 196608 | 176470 | true | 0 | 13199 | 1256.58 / 31.17 |
| CONTEXT-LIMITS #7 | qwen | 262144 | 235658 | true | 0 | 15390 | 1725.51 / 26.53 |
| CONTEXT-LIMITS #7 | gemma | 262144 | 235451 | true | 0 | 14201 | 944.27 / 37.18 |
| CONTEXT-OMNICODER | omnicoder | 65536 | 58711 | true | 5 | 9856 | 3805.49 / 58.33 |
| CONTEXT-OMNICODER | omnicoder | 131072 | 117694 | true | 5 | 11968 | 3016.83 / 47.03 |
| CONTEXT-OMNICODER | omnicoder | 204800 | 184051 | true | 5 | 14349 | 2458.28 / 38.87 |
| CONTEXT-GPT-OSS | gpt-oss | 65536 | 58210 | true | 5 | 14254 | 4286.53 / 93.32 |
| CONTEXT-GPT-OSS | gpt-oss | 131072 | 117194 | true | 0 | 15786 | 1742.6 / 58.84 |
| CONTEXT-GPT-OSS-UNRESTRICTED | gpt-oss | 65536 | 58210 | true | 0 | 14255 | 4297.41 / 95.35 |
| CONTEXT-GPT-OSS-UNRESTRICTED | gpt-oss | 131072 | 117194 | true | 0 | 15795 | 1959.5 / 66.25 |
| CONTEXT-GPT-OSS-REFERENCE | gpt-oss | 65536 | 58210 | true | 5 | 14261 | 4293.09 / 81.46 |
| CONTEXT-GPT-OSS-REFERENCE | gpt-oss | 131072 | 117194 | true | 0 | 15795 | 2986.95 / 61.83 |

### Qwen3.8 27B: operational throughput failure

| Quant / cache | Slot | Bound | Prefill completed | Observed prompt TPS | Peak MiB |
|---|---:|---:|---:|---:|---:|
| IQ4_XS / f16 | 204800 | 600 s | 14% | 48.9 | 15870 |
| IQ4_XS / q8_0 | 204800 | 600 s | 13% | 45.0 | 15851 |
| IQ4_XS / f16 | 131072 | 360 s | 15% | 55.9 | 15924 |
| UD-Q3_K_XL / f16 | 131072 | 600 s | 24% | 52.4 | 15852 |
| UD-Q3_K_XL / q8_0 | 131072 | 600 s | 21% | 45.7 | 15841 |

Weights were about 14.25 GB and 13.15 GB respectively. Both were downloaded and hash-verified, loaded, then removed after the minimum throughput gate failed. No coding, recall or effort score exists for these candidates; cancelled steps are unscored. This is not proof of an allocation ceiling or poor coding intelligence. Shared-memory spill was suspected but not measured. A larger GPU or smaller context/quant may change the result. Keep the pinned manifests for a future machine; no additional candidate was downloaded.

### Tool/module and setup evidence

The scripted native Pi baseline passed 3/9 compared with standard's 9/9: missing guard/LSP behavior was an expected baseline gap. Native hook checks passed 7/7; LSP freshness 4/4; policy checks and nested Bash cases passed their recorded suite. Web extraction/cache/find/error tests passed 13/14 while DuckDuckGo search failed. Browser form/isolation checks used a local page. One bounded real research task completed; no broad four-model research benchmark exists.

Pi App smoke checks verified SDK 1.3 without fallback, visible loaded model, context/output settings, effort registration, built-in switch and Browser panel configuration. Scripted provider checks inspected actual transmitted budgets. These are distinct from model intelligence. The initial GPT-OSS parser failure and one-token output clamp were setup defects: the initial loaded coding attempt is invalid for quality ranking. Missing search utilities and request budgeting were repaired before the final rerun; those repairs were not retroactively applied to the other three model runs.

### Reading the full observation archive

[observations.json](../results/observations.json) is organized by the original dated report names. It retains baseline profile matrices, live smoke/simple repair trials, every context sweep, final per-case coding runs, both effort rounds and criteria, GPT-OSS forensic controls, runtime/TUI checks, model switching, web trials and Pi App smoke settings. It includes fixture text and synthetic model answers as evidence, but no private conversation exports, credentials or machine paths. Administrative download/controller state is not a model-quality result.

Further confidence requires repeated matched runs, cold-start and fresh-clone acceptance, real repository tasks and task-level tests for optional GUI/research features. Do not generalize this small suite into a guarantee of autonomous software development.

## Optional development coding check

This is separate from the setup acceptance test. After activating the local tools, `pnpm eval:coding-check` previews two trials: one CSV repair with no padding, then the same task with 100000 unrelated background tokens. It uses Gemma and 131072 context. `pnpm eval:coding-check --models qwen --run` explicitly runs the small suite for another tested model. Add `--cases csv-records,pagination-contract,async-retry` only for a broader research run. Keep the tracked tree clean before execution. The suite preserves public checks, uses hidden grading and retains the existing six-minute per-repair bound. Reports stay ignored under .state/. This small sample is diagnostic, not a general model ranking.

## Simplified setup validation — October 23, 2026

The remaining command surface is startup, installation, doctor and acceptance. The standalone progress observer and defaults-merging/configuration demo were abandoned. Context settings, one automatic acceptance report and the small development suite were checked independently:

| Check | Result |
|---|---|
| Gemma real server with explicit context override | 65536 tokens verified; owned server stopped |
| Functional acceptance at 32768 tokens | 4/4 stages passed; 84.5 seconds; 54.5 mean generation tokens/sec |
| Automatic acceptance output | One report.json with settings, versions, model fingerprint evidence, outcomes and timings; no receipt pair |
| Saved everyday configuration | 204800 context preserved |

The development check used Gemma, 131072 context, one CSV repair, one background variant (101), reasoning enabled with a 2048-token budget and an 8192-token output cap. These are two task observations, not a new general model ranking:

| Condition | Full result | Hidden checks | Duration | Mean generation tokens/sec | Sampled peak adapter use |
|---|---|---:|---:|---:|---:|
| Clean | Pass | 6/6 | 212.0 s | 51.8 | 12.70 GB |
| 100000 background tokens prepared | Timeout | 6/6 | 361.8 s | 43.7 | 12.83 GB |

Both repairs preserved public files and passed the public and hidden code checks. The padded agent did not settle within the 360-second task deadline; correct code alone is insufficient for a full pass. Its finalized RPC usage/context-condition evidence was unavailable after the timeout, so this is not counted as a validated long-context success. Generation speed includes generated reasoning and excludes tool/prefill latency. Memory is sampled total adapter use, including the desktop, rather than isolated model allocation.

The controller cleaned up its server and inference lock. Its UI/exit handling was corrected after this run: it displays PASS/TIMEOUT per trial and returns a failing exit status when any coding trial fails, even if the controller itself completed. Regression fixtures replay this distinction without sending another model prompt. The production profile is isolated from development-run compaction settings.
