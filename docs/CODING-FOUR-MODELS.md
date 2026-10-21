# Four local coding models and GPT-OSS investigation

For the consolidated comparison and current recommendation, read [the four-model verdict](MODEL-VERDICT.md).

2026-10-21, RTX 4090 Laptop, 16,376 MiB GPU memory, native Windows, Pi 1.3.0 and llama.cpp b11669. One inference slot, reasoning enabled, 2,048 thinking-token budget and 8,192 total response cap. Three disposable repair projects, each clean and with exactly 100,000 unrelated field-journal tokens. Six minutes per trial; preserved tests, all hidden checks and normal completion are required. Single trials are exploratory evidence.

## Initial results

| Model / weights | Window | Clean passes | 100k passes | 100k hidden groups | Clean generation TPS | 100k generation TPS | Peak GPU MiB |
|---|---:|---:|---:|---:|---:|---:|---:|
| Qwen3.5 9B Q4_K_M | 204,800 | 2/3 | 0/3 | 11/18 | 71.1 | 49.1 | 14,453 |
| Gemma 4 12B IT Q4_K_M | 204,800 | 3/3 | 2/3 | 14/18 | 53.2 | 44.6 | 13,468 |
| OmniCoder 9B Q4_K_M | 204,800 | 2/3 | 2/3 | 17/18 | 71.6 | 49.0 | 14,393 |
| GPT-OSS 20B MXFP4, initial setup | 131,072 | 3/3 | invalid: 0/3 | 3/18 before repair | 132.3 | not measurable | 15,819 |

Generation rates are arithmetic means of completed response timing records; GPU memory includes the desktop. GPT-OSS's initial loaded zero TPS was a zero-duration single-token response, not a measurement of slow generation. Its 3/18 checks include checks the faulty fixture already passed, not three successful repairs. The [machine-readable comparison](../evaluation/CODING-MODELS-2026-10-21.json) preserves per-run sources. [Original GPT-OSS artifacts](../evaluation/archive/CODING-CONTEXT-GPT-OSS-2026-10-21-INITIAL.json) are retained separately from reruns.

## Confirmed setup fault

Pi's installed `pi-ai/dist/api/simple-options.js` clamps output using `model.contextWindow - estimateContextTokens(context).tokens - 4096`. Before first response, `utils/estimate.js` uses approximately characters / 3.5 rather than this model's tokenizer. The long natural-language prefix tokenizes to 100,000 GPT-OSS tokens but its character estimate exceeds the native 131,072-token window. Pi sends a one-token completion cap. All three initial loaded trials ended with `stopReason: length`; the CSV request used 101,928 prompt tokens and one output token. Pi then tried overflow recovery, which also failed to summarize within its estimated allowance. Disabling normal compaction did not disable overflow recovery. [Sanitized evidence](../evaluation/GPT-OSS-INITIAL-DIAGNOSTIC-2026-10-21.json).

The local fix is a native `before_provider_request` hook, scoped to our loopback GPT-OSS provider. It applies the loaded model's chat template, tokenizes the whole formatted request including tools, and sets the response allowance to min(configured cap, actual remaining window minus 512). The native window is unchanged. Each request logs before/after allowance and actual prompt count without logging prompts. Our first verification recorded **101,928 actual prompt tokens, cap 1 before / 8,192 after**. Later requests retain the same allowance when space permits. This adds two local CPU API calls, no additional model session and no token-consuming prompt instruction. Standard `pia` automatically loads the fix for GPT-OSS; GPT-OSS native-profile tests explicitly load this compatibility hook.

The implementation uses llama.cpp's documented [apply-template and tokenize endpoints](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md#post-apply-template-apply-chat-template-to-a-conversation). There is no patched dependency or fictitious enlarged context. Regression checks cover real remaining space, actual overflow and provider isolation.

## Separate recall issue

The initial GPT-OSS 64k recall trial generated reasoning but failed with `The model produced output that does not match the expected peg-native format`. At 128k it returned valid JSON with all five values wrong. These were not allocation failures; the f16 cache loaded successfully, peaking near 15,800 MiB total GPU use. Neither symptom is explained by the coding trial's one-token clamp alone. Recall was repeated separately; the completed controls below preserve the original [64k/128k evidence](../evaluation/archive/CONTEXT-GPT-OSS-2026-10-21-INITIAL.json). A parsing failure must be reported separately from a wrong answer.

OmniCoder passed 5/5 exact recall at each selected window: 65,536 (58.33 TPS, 9,856 MiB), 131,072 (47.03 TPS, 11,968 MiB), 204,800 (38.87 TPS, 14,349 MiB). Its actual prompt occupancy was about 90%. Qwen/Gemma's historical 256k allocation and recall tests used different windows and are preserved in [the context comparison](CONTEXT-COMPARISON.md); their 256k recall was 0/5 each. These results do not establish an allocation maximum for OmniCoder or GPT-OSS.

OpenAI's [implementation verification guidance](https://developers.openai.com/cookbook/articles/gpt-oss/verifying-implementations) recommends verifying API/tool handling, including returning raw reasoning. We are checking the local template, request budget and parser rather than assuming every failed agent run measures model capability. The GGUF's own template and native context remain in use; checksums are verified. Sampler changes, if tested, will be labeled as separate conditions.

## Additional portability repair

The first diagnostic coding run exposed a missing `fd`: Pi’s `find` tool failed four calls because `PI_OFFLINE=1` blocks its automatic download. We installed official SHA256-verified fd 10.5.0 and ripgrep 15.2.0 into ignored runtime/search, added their directories to the launcher PATH and the portable bootstrap. Ripgrep previously came from Codex’s installation path. A local filename/content search [preflight passed for both tools](../evaluation/SEARCH-TOOLS-2026-10-21.json). The full GPT-OSS rerun includes this dependency repair; older Qwen/Gemma/OmniCoder trials predate it, so strict cross-model comparisons require a future matched rerun. Original baseline artifacts are not rewritten.

For GPT-OSS, automatic threshold compaction is disabled while this upstream first-turn estimator issue exists; manual `/compact` remains available, and actual overflow recovery is a separate Pi mechanism. The exact-budget hook fixes requests after formatting, but cannot correct an earlier decision to compact from the character estimate. Other model profiles retain their previous compaction configuration.

The parser symptom has also been [reported upstream for this exact GPT-OSS GGUF](https://github.com/ggml-org/llama.cpp/issues/27720). That report is supporting context, not proof that our particular output failed for the same reason. The rerun records provider error messages and keeps reasoning/sampling controls separate.

Forensic inspection of the original 64k server log recovered a fully correct five-value final JSON after the parser rejection. [The diagnostic artifact](../evaluation/GPT-OSS-INITIAL-DIAGNOSTIC-2026-10-21.json) grades that raw final 5/5 but explicitly leaves the actual API trial failed. This demonstrates that the published 0/5 client score was not evidence that GPT-OSS could not retrieve the values at 64k. The original 128k answer was actually wrong and remains a separate observation.

## Completed coding rerun after repairs

The six-trial rerun `coding-context-1792618864396` kept the original 2,048 reasoning budget, 8,192 output cap, native 131,072 window and f16 cache. All actual formatted loaded requests retained at least 100,000 tokens. It ran after downloads finished, with portable search dependencies and the exact-budget hook.

| Model | Clean full passes | 100k full passes | 100k functionally correct | 100k hidden groups | 100k mean generation TPS | Highest GPU MiB |
|---|---:|---:|---:|---:|---:|---:|
| Qwen | 2/3 | 0/3 | 0/3 | 11/18 | 49.1 | 14,453 |
| Gemma | 3/3 | 2/3 | 2/3 | 14/18 | 44.6 | 13,468 |
| OmniCoder | 2/3 | 2/3 | 2/3 | 17/18 | 49.0 | 14,393 |
| GPT-OSS, repaired setup | 3/3 | 1/3 | 2/3 | 17/18 | 71.5 | 15,809 |

GPT-OSS clean generation averaged 114.4 TPS; the loaded weighted rate was 72.3 TPS. Loaded CSV passed all six hidden groups but its later malformed tool call was rejected by llama.cpp: a protocol failure, not an incorrect repair. Loaded pagination passed fully (6/6, normal completion). Loaded async retry finished normally but missed one hidden edge group (5/6), which is a coding failure. The original 0/3 loaded result was dominated by the one-token clamp and should not be used as a model-quality ranking. [Per-case rerun](../evaluation/CODING-CONTEXT-GPT-OSS-2026-10-21.md), [JSON including per-request budgets and provider errors](../evaluation/CODING-CONTEXT-GPT-OSS-2026-10-21.json).

The repaired run brings GPT-OSS close to OmniCoder on withheld groups and ahead on generation rate, while Gemma uses the least GPU memory and Gemma/OmniCoder had more full loaded passes. Different windows, one stochastic run and the portable-search repair limit a strict ranking. No default-model switch is made on this evidence.

## Finished recall controls and decision

All six new recall trials completed with no provider parser errors. With the repaired setup and original 2,048 thinking budget, GPT-OSS passed 5/5 at 64k and returned 0/5 at 128k (also used a tool despite the instruction). Unrestricted thinking with the default sampler returned wrong values at 64k; at 128k it retrieved all five values but added prose and wrote a file, failing the JSON-only/no-tools contract. Unrestricted thinking plus reference sampling passed 64k and returned wrong values at 128k. [Complete control table](../evaluation/GPT-OSS-INVESTIGATION-2026-10-21.md), [JSON](../evaluation/GPT-OSS-INVESTIGATION-2026-10-21.json). All use about 90% prompt fill.

Unrestricted means no separate thinking-token budget, while the total response cap remains 8,192; reasoning is never disabled. Reference sampling is temperature 1, top-p 1, top-k 0, min-p 0. The prompt corpus is deterministic, but seeds were not fixed; single trials cannot establish a causal improvement from a sampling or reasoning change. These controls did not provide a consistent improvement, so the launcher keeps its existing reasoning budget and sampler defaults. The exact token-budget hook and search dependencies remain installed.

The strongest confirmed explanation for the initially poor loaded coding result is the one-token clamp. The surviving limitations are occasional Harmony protocol failures, an actual async-retry coding error and unreliable strict recall in this synthetic near-full-window test. GPT-OSS can produce correct coding repairs under 100k background; the initial result should not be generalized to its coding ability. Its f16 peak of 15,809 MiB leaves only about 567 MiB on this 16,376 MiB GPU under the sampled desktop load, making it less comfortable than the other candidates for this PC. Further quality claims need repeated matched trials, including the repaired search environment on every model.

Validation: all 60 preexisting/current infrastructure checks passed in the full run; the two new recall-diagnostic checks and explicit GPT-OSS launcher-cap check also passed in targeted runs. JavaScript syntax, PowerShell parsing, result links and portable fd/rg filename/content preflights passed. The finite [batch record](../evaluation/GPT-OSS-BATCH-2026-10-21.json) is complete, inference lock released and the owned model server stopped. Runtime/model files and private traces remain outside Git.
