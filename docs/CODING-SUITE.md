# Coding suite: paired clean and 100k background

For the consolidated comparison and current recommendation, read [the four-model verdict](MODEL-VERDICT.md).

2026-10-21. The original Qwen/Gemma paired run completed 12 trials. OmniCoder and GPT-OSS subsequently completed six trials each. The [four-model results](CODING-FOUR-MODELS.md) include candidate results and the GPT-OSS setup investigation; the original paired evidence below is preserved. Preflight confirmed all three faulty fixtures fail public checks and at least one withheld group, while all three reference repairs pass public checks and 6/6 withheld groups.

## Observed results

| Measurement | Qwen3.5 9B Q4_K_M | Gemma 4 12B IT Q4_K_M |
|---|---:|---:|
| Clean: full agent passes | 2/3 | **3/3** |
| Clean: functionally correct repairs | 3/3 | 3/3 |
| 100k background: full agent passes | 0/3 | **2/3** |
| 100k background: withheld groups | 11/18 | **14/18** |
| Clean: mean generation TPS | **71.1** | 53.2 |
| 100k background: mean generation TPS | **49.1** | 44.6 |
| Highest sampled GPU memory, MiB | 14,453 | **13,468** |

Generation means are arithmetic means across completed response timing records in each condition; response counts and lengths differ. Weighted rates and every trial are preserved in the [JSON aggregate](../evaluation/CODING-CONTEXT-2026-10-21.json). See [the per-case table](../evaluation/CODING-CONTEXT-2026-10-21.md) and [preflight evidence](../evaluation/CODING-PREFLIGHT-2026-10-21.json).

**Gemma is the better coding-agent candidate in this run**, based on finishing more tasks correctly and using less VRAM. Qwen generates faster. Both produced correct clean-context code on all three projects, but Qwen continued working on CSV until timeout. With the background, both timed out on CSV (Qwen 1/6 groups, Gemma 2/6); Gemma passed pagination and retry while Qwen missed one edge-case group on each. Memory allocation succeeded throughout: capacity and coding quality remain separate.

The trace audit also found that Gemma reproduced the failing public check before editing in all six attempts; Qwen skipped that step in both retry attempts. Failure reproduction is a separate instruction-following observation, not part of the displayed code-plus-completion pass score. The original AssertionError-only detector missed the retry fixture's non-assertion failure; the audit uses the actual nonzero public-check invocation and tool order instead.

Keep the 204,800-token launcher limit unchanged; this run does not establish dependable coding with 100k irrelevant context. Prefer a focused coding session and external evidence notes over carrying unrelated research into every task. This is one run of three small projects per condition, with templated background and default sampling, not a statistically reliable global ranking. Repeat trials and include larger repository changes before replacing that qualification with a broad claim.

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

Each project has an intentionally faulty implementation, a complete specification and public smoke checks. After the agent finishes or reaches its time limit, the runner independently runs public checks and a separate withheld grader. Success requires all edge groups, public checks, preserved specification/public-test files, a valid context condition and no runner error. Record partial scores too. Report functional correctness separately from agent completion: a repair can be correct while its agent continues working until timeout. Observing the initial failure is recorded separately. Withheld tests are outside the project and are not supplied in the task; they are not protected from a model deliberately browsing parent folders by an OS sandbox. Grader integrity must be validated before spending model tokens.

Three cases × two models × two conditions = **12 trials** for one repetition. A fresh project and Pi session are used for every trial. Condition order alternates across cases/repetitions to reduce fixed warm-cache effects; one model/server runs at a time. Cache reuse can still affect elapsed time, and is reported through usage rather than treated as intelligence. Natural task difficulty, small sample size and sampling variation prevent a general model ranking from one run.

Both models use the same standard guard/LSP profile but expose only seven basic coding tools for this first model comparison. This does not evaluate LSP-assisted coding; test that separately. Reasoning is on, with a 2,048-token thinking budget and an 8,192 total-output cap per response. Each agent trial is bounded to six minutes; there is no automatic second attempt after a failed trial. A repeated suite starts new trials, rather than selecting the best answer from repeated attempts.

The completed-response audit requires a final normal `stop`; token-limit endings and errors do not count as a full agent pass even if the files happen to pass. Functional correctness remains a separate column. The wall-clock limit is an interactive-use budget, not equal total generated tokens: a slower model gets fewer generation opportunities within six minutes. Sampling uses the existing server defaults and no fixed seed; repeated trials and sampling/budget calibration are needed before a broad quality ranking.

Record hidden/public correctness, response and tool-call counts, actual input/output/cache tokens, generation TPS arithmetic and weighted means, prompt TPS, agent elapsed time, and approximately one-second sampled total GPU-memory peaks during each agent trial. Agent time includes prefill and tools, excludes server startup and background construction; grader time is excluded. Retain per-response timings and raw failures privately. There is no system-RAM peak measurement yet.

## Commands for a later run

The runner requires explicit `--run`. It is **not** wired into `pnpm test`, the launcher, a scheduler, or any current benchmark run.

```powershell
. .\scripts\Activate-Tools.ps1
# Help only; does not start a model:
pnpm eval:coding-context
node evals/coding-preflight.mjs
# Execute after validating fixtures and graders:
pnpm eval:coding-context --run
# A smaller first trial:
pnpm eval:coding-context --run --models=qwen --cases=csv-records
# Repeated paired comparison:
pnpm eval:coding-context --run --repeat=3
```

Source: [cases and withheld graders](../evals/coding-cases.mjs), [runner](../evals/coding-context.mjs), [preflight](../evals/coding-preflight.mjs). Raw results stay under ignored `.state/evals/coding-context-*`. `node evals/export-coding-context.mjs` writes a sanitized public aggregate and preserves per-response TPS. Concurrent throttled model downloads can affect disk/network timing; do not describe this as a fully isolated performance benchmark.

## Download queue

The initial cap recovered from the earlier setup thread was **2,190,349 bytes/second**, approximately 17.5 Mbps. The user then specified **35% of the measured connection rate**. With the queue paused, three download-only Cloudflare probes of 25 MB each measured 9,063,418 / 10,068,274 / 10,276,879 bytes/s. The median is approximately 80.5 Mbps; the resumed cap is **3,523,895 bytes/s**, approximately **28.2 Mbps**. These are short throughput samples, not the ISP's guaranteed capacity. The private measurement record is `.state/download-speed-test.json`.

[The pinned queue](../manifests/coding-model-downloads.json) downloads OmniCoder Q4_K_M first, then GPT-OSS-20B MXFP4, using immutable revisions and expected SHA256/size. [The worker](../scripts/Download-CodingModels.ps1) uses one sequential curl transfer, resumable `.part` files and hash verification before advancing. It holds an exclusive queue lock; personal model files are never removed to resolve a mismatch. Both model files total about 17.85 GB; weight-file size is not loaded VRAM.

```powershell
.\scripts\Download-CodingModels.ps1 -RateLimit 3523895
Get-Content .state\coding-downloads.json
```

The current worker runs hidden with output/error logs under ignored `.state`. Final files live under the machine's configured model directory. No projector or extra model is downloaded, and downloading does not enable a new `pia --local-model` selection or establish tool compatibility.

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
