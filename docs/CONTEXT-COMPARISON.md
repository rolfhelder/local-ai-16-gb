# Local-model context measurements on the 16 GB PC

For the consolidated comparison and current recommendation, read [the four-model verdict](MODEL-VERDICT.md).

The original Qwen/Gemma capacity comparison is preserved below. OmniCoder and GPT-OSS have now completed the candidate batch; see [all four coding results and setup diagnostics](CODING-FOUR-MODELS.md). OmniCoder passed exact recall at 64k, 128k and 200k. GPT-OSS loaded its native 128k window but its initial recall trials failed (one parser error and one incorrect answer); these are distinct from allocation success.

Both models default to **204,800 tokens (200k)** in `pia`, leaving more VRAM headroom than the 256k stress test. Both loaded a 262,144-token window and processed approximately 235k input tokens. The 256k results below remain capacity evidence, not a quality assessment or the current default. The context budget includes prompts, tools and generated tokens.

Use `pia --model qwen` or `pia --model gemma`. Reasoning is enabled for both: Pi `medium`, llama.cpp thinking budget 2,048, total output cap 8,192, one slot, port **48763**. `pia --dry-run` prints the complete local commands; [the launcher guide](LAUNCHER.md) explains them. OmniCoder is now the default selection; these Qwen/Gemma measurements are historical. Both projectors stay unloaded for text-only tests.

| Measured test | Qwen3.5 9B Q4_K_M | Gemma 4 12B Q4_K_M | Winner |
|---|---:|---:|---|
| Current configured context | 204,800 tokens | 204,800 tokens | Tie |
| Largest stress-tested loaded context | 262,144 tokens | 262,144 tokens | Tie |
| 256k near-full prompt: sampled peak GPU memory | 15,390 MiB | **14,201 MiB** | Gemma |
| 256k near-full prompt: generation speed | 26.5 tokens/s | **37.2 tokens/s** | Gemma |
| 256k near-full prompt: prompt processing speed | **1725.5 tokens/s** | 944.3 tokens/s | Qwen |
| 256k near-full prompt: exact word-code recall | 0/5 | 0/5 | Tie |
| 192k word-code recall (4,096 output cap) | **5/5** | 0/5 | Qwen |
| 192k word-code trial: sampled peak GPU memory | 14,201 MiB | **13,199 MiB** | Gemma |
| 32k coding: observed failure, repaired tests, original test file preserved | PASS | PASS | Tie |
| 32k coding: mean generation speed across responses | **76.4 tokens/s** | 41.5 tokens/s | Qwen |
| 32k coding: complete Pi run, excluding server startup | **21.9 seconds** | 30.1 seconds | Qwen |

Bold values identify a winner for that measured row; ties are unbolded. Lower GPU memory and elapsed time win their rows. Higher TPS and exact recall win theirs. These are single exploratory trials, not a ranking of general intelligence.

## Conditions and interpretation

The main 256k rows use a final matched run: both models at 262,144, reasoning on with a 2,048-token budget, output capped at 8,192, roughly 90% prompt occupancy, five word-shaped codes scattered through dense synthetic hexadecimal records. Actual prompt lengths differ slightly by tokenizer. Both run sequentially on the same RTX 4090 Laptop GPU with **16,376 MiB total memory**, native Windows, Pi 1.3.0 and llama.cpp b11669. All GPU layers are requested, KV cache is f16, automatic fitting is off, context shifting is off and parallel slots are one.

GPU figures are the maximum of approximately one-second `nvidia-smi` samples during each trial, including model startup, inference and the desktop. They are sampled peaks, not an exact physical maximum or model-only allocation. Background desktop activity and model transitions can move these numbers. MiB / 1024 gives GiB. No system-RAM peak or CPU-offload performance benchmark is claimed.

Prompt TPS and generation TPS come from llama.cpp's completed timing lines, recorded separately for every response. Generation includes thinking tokens. The short coding fixture has five Qwen responses and six Gemma responses; its displayed TPS is the arithmetic mean across responses. Weighted generation TPS is also preserved in the JSON. Do not average unrelated context sizes into a model-wide winner. Timings and memory alone do not measure answer quality.

The 32k coding fixture is intentionally small: run three failing arithmetic assertions, inspect and repair one function, rerun tests, then independently verify both the result and that the test file was preserved. Both models passed with reasoning enabled. Its latency excludes server startup and includes Pi/tool overhead. It does not establish performance on complex repository changes, nor coding quality at a nearly full 256k context.

The final 256k probe runs through native Pi RPC with extensions excluded to preserve the inference baseline; the coding fixture uses the standard guard/LSP profile. Normal interactive `pia` uses that standard profile. Its absolute context status is displayed by a native Pi hook, verified in an actual 80-column TUI using a scripted provider.

## Other matched recall controls

| Earlier reasoning-off control | Qwen | Gemma | Winner |
|---|---:|---:|---|
| 128k: exact hex-code recall | **5/5** | 0/5 | Qwen |
| 128k: sampled peak GPU memory | 11,686 MiB | **10,508 MiB** | Gemma |
| 128k: generation speed | **47.8 tokens/s** | 44.2 tokens/s | Qwen |
| 128k: prompt processing speed | **3116.9 tokens/s** | 1792.1 tokens/s | Qwen |
| 192k: exact hex-code recall | 0/5 | **3/5** | Gemma |
| 192k: sampled peak GPU memory | 14,077 MiB | **12,334 MiB** | Gemma |
| 192k: generation speed | 39.9 tokens/s | **40.0 tokens/s** | Gemma |
| 192k: prompt processing speed | **2511.1 tokens/s** | 1403.7 tokens/s | Qwen |
| 256k: exact hex-code recall | 0/5 | 0/5 | Tie |
| 256k: sampled peak GPU memory | 15,658 MiB | **13,613 MiB** | Gemma |
| 256k: generation speed | **35.2 tokens/s** | 27.9 tokens/s | Qwen |
| 256k: prompt processing speed | **2208.0 tokens/s** | 908.7 tokens/s | Qwen |

These earlier control runs used reasoning **off**, a 256-token output allowance and five hexadecimal lookup codes, at roughly 90% prompt fill. They must not be pooled with the reasoning-enabled word-code runs above. At 192k, Gemma returned three exact codes while Qwen returned none; at 128k Qwen returned all five while Gemma returned none. The non-monotonic result is a reason to repeat trials, not to define a dependable threshold from one success.

With word-shaped codes, reasoning enabled and a 2,048/4,096 thinking/output allowance, Qwen passed 5/5 at 192k and Gemma passed 5/5 at 64k and 128k. Gemma's 192k answer contained all five correct numeric portions but omitted their word prefixes: **0/5 under the exact contract**, a formatting failure that should not be described as total memory loss. Both the identifier pattern and thinking allowance changed from the earlier control, so the cause of improvement is not isolated.

An earlier 512-token thinking-budget Gemma 64k run exhausted its 1,024-token output cap and produced invalid JSON. **64k is not its model limit.** Its local GGUF declares 262,144, it loaded that window and processed a near-full prompt. There is no context-capacity reason from these trials to download a different Gemma.

## What “until failure” established

Both GGUF files declare a native context of **262,144**. Larger requests caused this llama.cpp build to cap the slot back to 262,144; the launcher's requested/reported-context check rejected the mismatch. The smallest rejected request during refinement was 270,336 for both. This establishes the server/native-context boundary. It does **not** establish the GPU's absolute allocation limit: no verified VRAM out-of-memory boundary was reached before that cap.

The original recall grader accepted a code embedded inside a longer invented string. All saved trials were regraded using exact JSON keys and whole-string equality, and negative controls now reject appended suffixes, wrong keys, malformed JSON and extra fields. Public reports use the corrected scores. One redundant final Gemma repeat in the early control sweep was stopped after the complete 256k trial; the skipped repeat has no claimed measurements.

Sampling remains llama.cpp's observed defaults (temperature 0.8, top-k 40, top-p 0.95, min-p 0.05, random seed), rather than a repeated fixed-seed benchmark. The long inputs are synthetic and adversarial. Repeat natural-document retrieval, repository tasks and compaction before drawing dependable quality conclusions.

## Reproduce and inspect

```powershell
. .\scripts\Activate-Tools.ps1
pnpm test
pnpm eval:coding
node evals/context-limits.mjs --models=qwen,gemma --contexts=262144 --pattern=words --reasoning-budget=2048 --output-tokens=8192 --no-refine
node evals/audit-limits.mjs
node evals/export-coding.mjs
node evals/export-comparison.mjs
```

These GPU tests hold the same exclusive lock as `pia`. Exit an interactive session first. Public artifacts are [the comparison aggregate](../evaluation/MODEL-COMPARISON-2026-10-21.json), [all audited context trials](../evaluation/CONTEXT-LIMITS-2026-10-21.json), and [coding runs](../evaluation/CODING-2026-10-21.json). The export writes a Markdown table under ignored `.state`; the comparison document embeds that table. Private server logs and full Pi traces stay under ignored `.state/evals`; the public aggregates include synthetic codes and answers for auditing the grader.

Exact files and verified SHA256 values:

| Model | File | SHA256 |
|---|---|---|
| Qwen3.5 9B | `Qwen3.5-9B-Q4_K_M.gguf` | `03b74727a860a56338e042c4420bb3f04b2fec5734175f4cb9fa853daf52b7e8` |
| Gemma 4 12B IT | `gemma-4-12b-it-Q4_K_M.gguf` | `0a270ec9fe6b34f4a0d33992b6135117b484ebc4766ab76b51d4ae8c457e4c42` |

Pinned download revisions, sizes and projector hashes are in [the model manifest](../manifests/models.download-plan.json). The experiments use the existing files, not a fresh model download or cloud endpoint.
