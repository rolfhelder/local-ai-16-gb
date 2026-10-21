# Evaluation protocol and first evidence

A [paired clean/100k-background coding suite](CODING-SUITE.md) is prepared. Its execution and fixture/grader validation are **on hold** at the user's request; no new model results are claimed. The runner requires explicit `--run` and is not part of the default test command.

Current defaults are **200k (204,800 tokens) for both Qwen and Gemma**, reasoning enabled, 2,048 thinking tokens and 8,192 total output tokens, on port 48763. See [the model comparison](CONTEXT-COMPARISON.md) for the newer capacity, VRAM, TPS and strict five-needle recall results. The original Qwen-only baseline below preserves its historical settings.

The current unit suite passes **53/53** checks, covering policy, context-status formatting, exact recall grading, server timing parsing and generation budgets. The real 80-column Pi TUI displays the added context status. Four LSP freshness cases pass: initial error, clearing after a fix, detecting a newly introduced error, and references excluding a same-text string. The latest tool matrix still passes 9/9 for `standard`.

The optional `web` profile adds `@arcanemachine/pi-web-search@3.0.0` without model-based summaries or paid fallback. Its isolated scripted trial passes **13/14** checks, including UTF-8 extraction, bounded output, caching, pagination, literal find, redirect provenance, rejected file URLs, HTTP errors and an official Pi document fetch. Live DuckDuckGo search fails with `parse_failed` (invalid title or URL in a result). This is an observed failure, so the module remains optional. The loader also warns about its TypeBox dependency declaration. See [the sanitized trial](../evaluation/MODULE-TRIALS-2026-10-21.json). No model tokens were used in this tool trial.

2026-10-21. Run from the repository after activating portable tools:

```powershell
. .\scripts\Activate-Tools.ps1
pnpm test
pnpm eval:hooks
node evals/guard-integration.mjs
pnpm eval:tools
node evals/browser.mjs
pnpm eval:live
pnpm eval:statusline
node evals/lsp-freshness.mjs
pnpm eval:web
pnpm eval:coding
node evals/context-limits.mjs --models=qwen,gemma --contexts=262144 --pattern=words --reasoning-budget=2048 --output-tokens=8192 --no-refine
node evals/live.mjs --contexts=65536,102400
node evals/live.mjs --contexts=102400 --fill=0.93
```

The first four use **zero model tokens**. The browser test uses isolated Edge sessions and a local HTTP fixture. Live tests acquire the same exclusive inference lock as `pia`, launch one local llama.cpp server and stop only a server they own. They never use personal source files. Browser sessions and test directories are uniquely named. Do not run destructive examples against personal data.

## Fair comparison

Start with native Pi, then add one capability. The scripted tool matrix uses identical fixtures, calls and warm-up delays for every profile; raw and adapted LSP profiles are separate. Missing tools, error results and false-clean diagnostics fail. Filesystem effects, source locations and actual tool results are graded rather than assistant success claims. Baseline gaps are expected evidence, so the matrix reports them without treating them as a runner crash. A single requested profile exits nonzero if any target capability is missing. `standard` must pass the combined contract.

Current matrix has **nine checks**: UTF-8 read, bounded read, exact edit, headless deletion blocking, semantic type error, barrel/alias definition, inferred-type hover, cross-file references and rename preview preserving files.

| Profile | Passed | Interpretation |
|---|---:|---|
| native | 3/9 | Native files pass; permission policy and LSP absent |
| guard-module | 3/9 | Unadapted pi-guard does not stop PowerShell deletion |
| guard | 4/9 | Windows + Bash policy adapter adds destructive-action protection |
| lsp | 7/9 | Raw LSP navigation works after opening dependencies; Windows diagnostics fail |
| lsp-windows | 8/9 | Diagnostic URI fix adds type-error detection; no guard in this profile |
| standard | 9/9 | Combined adapters satisfy current checks |

There are also **37** PowerShell policy/approval tests, **five** real parsed-Bash guard tests and **seven** native-hook integration checks. TUI approval callbacks are unit-tested, not an end-to-end terminal dialog usability test. Cold LSP failures remain in ignored traces; warm navigation does not establish reliable cold project discovery. Changed-file freshness now has four passing cases; shadowed-symbol references and larger-language-server comparisons still need additional cases.

## Real Qwen baseline

Verified GGUF SHA256: `03b74727a860a56338e042c4420bb3f04b2fec5734175f4cb9fa853daf52b7e8`. Pi 1.3.0 → OpenAI-compatible local provider → llama.cpp b11669 → Qwen3.5-9B Q4_K_M. Text-only, reasoning disabled, all GPU layers, one slot. The projector was not loaded. GPU: RTX 4090 Laptop, **16,376 MiB**; measurements include the running desktop.

| Server context | Actual prompt tokens¹ | Recall | Approx. GPU used after run | Pi run time² |
|---:|---:|---|---:|---:|
| 8,192 | 5,536 | PASS | 7,546 MiB | 3.9 s |
| 16,384 | 11,239 | PASS | 7,810 MiB | 4.4 s |
| 32,768 | 22,597 | PASS | 8,338 MiB | 7.2 s |
| 65,536 | 45,357 | PASS | 9,394 MiB | 13.5 s |
| 102,400 | 70,960 | PASS | 10,582 MiB | 21.7 s |
| 102,400 | 94,460 | PASS | 10,581 MiB | 30.4 s |

¹ Prompt occupancy is Pi's reported input + cache-read tokens; cache is reused between some requests. These are measured provider usage, not character estimates. ² Includes the Pi RPC run, excludes model-server startup and fixture/tokenization preparation. VRAM is sampled before/after, **not a measured peak**.

The recall task hides one code in unique synthetic records. Each size has one successful trial. This establishes an initial capacity/recall envelope, not robust long-context reasoning, multi-needle retrieval, resistance to distractors, or complex repository coding. The native coding trial passed a real read → exact edit → final report cycle and preserved UTF-8 lines. The final `pia` standard-profile print run also read the fixture successfully. No paid/cloud inference was needed.

Those original runs used a 32,768 launcher default, a 2,048 output cap and a 4,096 compaction reserve. Current settings supersede them: **204,800 context**, 8,192 total output tokens, 2,048 thinking tokens, compaction reserving 8,192 and keeping 6,000 recent tokens. Compaction quality and very long generated answers have not been validated. Large context capacity does not remove the need for evidence files, bounded fetches and short working summaries.

## Research trial: working pipeline, failed synthesis accuracy

The optional Research profile completed a real local Qwen depth-0 trial with one query and one analyzed official source. End-to-end time: **220.5 seconds**. Its own summary reported **13,571 tokens**, including **2,911 cache tokens**, and $0 inference cost. The outer tool call was scripted; internal research inference and public-web fetches were real. No multi-researcher team was used.

The output correctly described the main tool lifecycle and cited the official page, but it placed `user_bash` propagation rules and provider-event fields under `tool_call`. The installed Pi `ToolCallEventBase` and `ProviderStreamEvent` declarations distinguish those payloads. This is a **synthesis accuracy failure**, despite no tool error and a valid citation. Keep this profile experimental. The next comparison should measure direct search/fetch + a narrowly bounded extraction against this integrated research pipeline, including source fidelity, latency and tokens. YouTube captions, absent-caption ASR and lesson/quiz quality have not passed an end-to-end test.

## Token economics and future coverage

The post-startup inventory audit found that registering extensions activated extra tools beyond `defaultTools`. A small native hook removes six unused AST/LSP tools and three duplicate browser tools from the initial active set. This keeps browser work on Playwright CLI. Standard goes from 18 tools / 8,194 schema characters to **12 tools / 5,076 schema characters**, about **38% fewer schema characters**. This is schema JSON size only, not total prompt tokens or a model tokenizer measurement. Native has seven active tools, Research 15 and Desktop 20. `node evals/inventory.mjs` checks these budgets without calling a model; results are in `evaluation/TOOL-INVENTORY-2026-10-21.json`.

`evals/requirements.json` is the capability contract, including **planned** cases. Do not present it as an implemented full suite. Tests record duration, result characters and system-prompt characters; character/4 estimates are explicitly labeled and omit tool schemas. Live traces record actual input/output/cache usage. Complete prompt overhead in tokenizer tokens, repeated-trial distributions, retry rates, context-compaction quality, search provider accuracy and transcript/ASR fixtures remain work to implement before ranking alternatives by token efficiency.

Store raw sessions and sensitive traces under ignored `.state/evals/`; commit only sanitized aggregates. Model-dependent tests are separate commands so a guard or hook regression does not spend inference tokens. Use frozen dependencies and record model/template/server revisions with every comparison. Search answers require claim-to-source auditing; a citation-shaped string is not proof.
