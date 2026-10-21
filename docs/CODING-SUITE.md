# Coding suite: prepared, not run

2026-10-21. Execution is on hold at the user's request. No result, fixture-validation pass, or model ranking is claimed for this suite. No model downloads are required for the Qwen/Gemma comparison. OmniCoder and GPT-OSS are researched alternatives, not installed trial participants.

## What the experiment measures

Adding 100k unrelated tokens is a useful **context-interference test**. Pair it with clean-context coding on identical projects to measure the loss, rather than confusing ordinary coding errors with distraction. This does not test retrieval of relevant old facts or long-term conversation memory. It is also distinct from requesting a 100k context window: the server window stays 204,800, while the loaded condition adds 100,000 background tokens before the current coding task.

The background is deterministic, synthetic prose about nature journals. It contains no project specifications, code, solutions, tool instructions, or benchmark answers. There is no retrieval question about it. A delimiter identifies it as unrelated background; the current task appears afterward. The runner tokenizes and truncates it using each active model's tokenizer, then checks the token roundtrip equals 100,000. Actual first-request input plus cache-read tokens is recorded, including Pi/master prompt and tooling overhead. Different tokenizers mean the exact text endpoint can differ; record a per-model background hash.

This first design places background and task in one user message. It measures interference from a long prefix, not a 100k multi-turn conversation. The prose is templated, so a later natural-document corpus and previous-conversation condition would improve realism. Keep those as separate experiments.

## Cases and scoring

| Disposable project | Required work | Withheld edge-case groups |
|---|---|---:|
| CSV records | State-aware parsing, quoted commas/newlines, escaped quotes, empty fields, CRLF and Unicode | 6 |
| Pagination contract | Coordinate service and pagination changes, defaults, bounds, validation and immutability | 6 |
| Async retry | Attempt numbering, falsy results, original errors, retry policy and awaited injected delays | 6 |

Each project has an intentionally faulty implementation, a complete specification and public smoke checks. After the agent finishes, the runner independently runs public checks and a separate withheld grader. Success requires all edge groups, public checks, preserved specification/public-test files, a valid context condition and no runner error. Record partial scores too. Observing the initial failure is recorded separately. Withheld tests are outside the project and are not supplied in the task; they are not protected from a model deliberately browsing parent folders by an OS sandbox. Grader integrity must be validated before spending model tokens.

Three cases × two models × two conditions = **12 trials** for one repetition. A fresh project and Pi session are used for every trial. Condition order alternates across cases/repetitions to reduce fixed warm-cache effects; one model/server runs at a time. Cache reuse can still affect elapsed time, and is reported through usage rather than treated as intelligence. Natural task difficulty, small sample size and sampling variation prevent a general model ranking from one run.

Both models use the same standard guard/LSP profile but expose only seven basic coding tools for this first model comparison. This does not evaluate LSP-assisted coding; test that separately. Reasoning is on, with a 2,048-token thinking budget and an 8,192 total-output cap per response. Each agent trial is bounded to six minutes; there is no automatic second attempt after a failed trial. A repeated suite starts new trials, rather than selecting the best answer from repeated attempts.

Record hidden/public correctness, response and tool-call counts, actual input/output/cache tokens, generation TPS arithmetic and weighted means, prompt TPS, agent elapsed time, and approximately one-second sampled total GPU-memory peaks during each agent trial. Agent time includes prefill and tools, excludes server startup and background construction; grader time is excluded. Retain per-response timings and raw failures privately. There is no system-RAM peak measurement yet.

## Commands for a later run

The runner requires explicit `--run`. It is **not** wired into `pnpm test`, the launcher, a scheduler, or any current benchmark run.

```powershell
. .\scripts\Activate-Tools.ps1
# Help only; does not start a model:
pnpm eval:coding-context
# Later, after validating fixtures and graders:
pnpm eval:coding-context --run
# A smaller first trial:
pnpm eval:coding-context --run --models=qwen --cases=csv-records
# Repeated paired comparison:
pnpm eval:coding-context --run --repeat=3
```

Source: [cases and withheld graders](../evals/coding-cases.mjs), [runner](../evals/coding-context.mjs). Results will be private under ignored `.state/evals/coding-context-*`; no result exporter or aggregate has been created yet. Before the first model run, validate each faulty fixture fails and a reference repair passes every grader. Then run a small trial before the full matrix.

## Benchmark source check

[Tesslate's OmniCoder model card](https://huggingface.co/Tesslate/OmniCoder-9B#benchmarks) reports Terminal-Bench 2.0 **23.6% (21/89)** versus **14.6% (13/89)** for its Qwen3.5-9B baseline. It also reports GPQA Diamond pass@1 83.8 and AIME 2025 pass@5 90. These are author-reported results. Pass@5 must not be compared directly with pass@1. No GPT-OSS Terminal-Bench score is supplied in that table. The linked card does not establish a controlled OmniCoder-versus-GPT-OSS coding winner.

[OpenAI's original GPT-OSS model card, Table 3](https://arxiv.org/html/2508.10925v1#S2.SS6.SSS4) reports these GPT-OSS-20B results:

| Benchmark | Low reasoning | Medium | High |
|---|---:|---:|---:|
| SWE-bench Verified | 37.4 | 53.2 | 60.7 |
| Aider Polyglot | 16.6 | 26.6 | 34.2 |
| Codeforces Elo, no tools | 1,366 | 1,998 | 2,230 |
| Codeforces Elo, with tools | 1,251 | 2,064 | 2,516 |

These original results use OpenAI's evaluation scaffolds and reasoning settings, not Pi with our thinking cap. The [official release](https://openai.com/index/introducing-gpt-oss/) specifies a 128k context family, so GPT-OSS is not a drop-in 200k-context candidate. A 100k-background trial may be possible within its window, but memory, tool/template compatibility and remaining output headroom need verification. Its [official weights card](https://huggingface.co/openai/gpt-oss-20b) states that evaluations used MXFP4 and that Harmony formatting is required. Do not infer that a 16 GB deployment claim guarantees 100k context on this laptop.

The two models lack a verified, same-scaffold head-to-head coding benchmark in the sources checked here. OmniCoder is the closer memory/context candidate; GPT-OSS has more published repository/editing evidence, with materially different reasoning and context conditions.
