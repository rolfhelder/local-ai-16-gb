# Evidence and acceptance tasks

Current implemented suites and measured results are in [EVALS.md](EVALS.md); the broader tasks below remain the acceptance roadmap, not a claim that every capability has passed.

## Evidence levels

- **Researched:** primary README/docs inspected; claims not run locally.
- **Observed:** local file or command output inspected.
- **Smoke-tested:** a narrow command or load succeeds.
- **Task-validated:** representative work completes with checked outputs.

Do not describe all four as “working.” Candidate extensions remain researched until a trial is recorded. See `evaluation/RESULTS.md` for this pass's actual checks.

## Acceptance queue

| Trial | Task and pass condition |
|---|---|
| A: tool loop | In a disposable repo, create a function, run a meaningful test, inspect an intentional failure, fix it, rerun; no fabricated tool output |
| B: model repair | Give a deliberately malformed argument request or failed command; model recovers within a bounded number of turns |
| C: context | Repeat A after a bounded document-reading batch; record context/memory and check for compaction loops |
| D: search | Find current primary sources, open 3, produce 5 supported claims and working URLs; no citation to an unread page |
| E: YouTube | Discover a video, retrieve timestamped captions, answer a specific question with timestamp; label manual/automatic/local ASR |
| F: browser | Open a local test app, fill a harmless form, inspect resulting DOM and verify behavior; compare MCP discovery modes |
| G: Windows GUI | Read a known text in a harmless desktop app, change a disposable value, verify it; no personal account actions |
| H: vision | Describe a prepared screenshot containing small labels and a diagram; mark uncertainty and verify grounding |
| I: child agent | One bounded child uses the same local model/profile, saves an artifact, can be cancelled; no cloud fallback |
| J: research/teach | Research a topic in batches, save source ledger and lesson, quiz learner, preserve unanswered questions |
| K: migration | Fresh clone/copy on other PC, reconstruct from manifest/backup, rerun A/D/E/F/G |

For each candidate record exact source/ref, resolved dependencies, Pi version, llama.cpp build/backend, model revision and quantization, context, slots, peak VRAM/RAM, time to first response, total duration, intervention count and correctness. Note server queueing and CPU offload; tokens/sec alone misses tool and prompt-prefill delays.

Use `evaluation/TRIAL-TEMPLATE.md`. Put sensitive raw logs under ignored `evaluation/local/`; commit only sanitized summaries. Failed trials are useful evidence and should be recorded honestly.

## Regression boundaries

One changed variable per trial: Pi upgrade, llama.cpp upgrade, model, context, sampling, or extension. Keep the previous working manifests/profile in a private backup. Remove a failed candidate's package declaration and restore the previous settings to roll back; do not delete downloaded models as a troubleshooting shortcut.

Native PowerShell is part of the baseline. Test any planning/permission guard against PowerShell and custom tools, rather than assuming its Bash examples cover them. Test subprocess cancellation on Windows separately from Linux documentation.

## Four-model follow-up

Qwen, Gemma, OmniCoder and GPT-OSS have completed their initial coding runs. See [all four results and GPT-OSS setup repairs](CODING-FOUR-MODELS.md), including the invalid initial GPT-OSS loaded trials, portable search dependencies and exact request-token budgeting. Original artifacts are retained; rerun outcomes and separate recall controls are linked there.
