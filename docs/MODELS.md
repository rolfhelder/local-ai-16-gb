# Tested models and limitations

Measured on Windows with an RTX 4090 Laptop GPU (16376 MiB VRAM), 32 GiB system RAM, Pi 1.3.0 and llama.cpp b11669. Results are small local samples from October 21–22, 2026. **Gemma is the current user-selected default** for `local-ai` and `local-ai-app`.

## Coding and memory

Each model repaired three projects clean and with 100000 unrelated background tokens. A full pass requires preserved public checks, all hidden checks and normal agent completion within six minutes. Reasoning was on (2048 thinking tokens / 8192 total output), f16 KV, one slot.

| Model / quantization | Coding context | Clean passes | 100k passes | Mean loaded generation TPS | Peak coding GPU use |
|---|---:|---:|---:|---:|---:|
| Qwen3.5 9B Q4_K_M | 204800 | 2/3 | 0/3 | 49.1 | 14.11 GiB |
| **Gemma 4 12B IT Q4_K_M** | 204800 | **3/3** | **2/3** | 44.6 | **13.15 GiB** |
| OmniCoder 9B Q4_K_M | 204800 | 2/3 | **2/3** | 49.0 | 14.06 GiB |
| GPT-OSS 20B MXFP4 | 131072 | **3/3** | 1/3 | **71.5** | 15.44 GiB |

TPS includes generated reasoning, not tool/prefill latency. VRAM is sampled total adapter use including Windows/display, not isolated model allocation. GPT-OSS has a smaller native window. Its displayed result is the repaired rerun after a request-budget clamp and missing search-tool dependency were corrected; older models did not receive an identical environment rerun. Hidden groups within a task are correlated, and one run is not a general benchmark.

Gemma completed the most full coding tasks (5/6) and used the least memory. OmniCoder had useful long-context recall and low output volume in this sample. GPT-OSS was fastest and often repaired code correctly, but a later malformed tool exchange invalidated one loaded task. Qwen's clean CSV code was correct but timed out; that is distinct from an incorrect repair.

## Context: allocation, inference and recall are separate

| Model | Largest completed inference window tested | Retrieval evidence and operating choice |
|---|---:|---|
| Qwen3.5 9B | 262144 | Processed about 235k input tokens; exact word-code recall passed at 192k in an earlier control and failed at 256k. Windows operating default 204800. |
| Gemma 4 12B | 262144 | Processed about 235k input tokens; earlier 64k/128k exact recall passed, 192k/256k strict word-code recall failed. Current default remains 204800 by user choice. |
| OmniCoder 9B | 204800 | Exact five-value recall passed at tested 64k, 128k and 200k windows at about 90% fill. 256k was not tested here. |
| GPT-OSS 20B | 131072 | Native ceiling 131072. Repaired default-budget recall passed at 64k and failed the 128k contract; an unrestricted 128k control retrieved values but violated the JSON/no-tools instructions. |

Historical recall conditions differ in identifier format and output allowance. These are not matched sweeps and do not establish a statistical reliability boundary. See [how to rerun capacity and quality checks](TESTING.md).

## `/effort` task, independent scores

One clean first attempt plus one diagnostic follow-up; 13 behavioral checks. No score weighting. Capacity was 204800 for the first three models and native 131072 for GPT-OSS.

| Model | Round 1 | Round 2 | Mean generation TPS R1 / R2 | Peak effort-run GPU use |
|---|---:|---:|---:|---:|
| Gemma 4 12B | 2/13 | 6/13 | 49.2 / 41.6 | 13.44 GiB |
| Qwen3.5 9B | 0/13 | **7/13** | 44.3 / 45.1 | 14.30 GiB |
| OmniCoder 9B | 0/13 | 0/13 | 55.0 / 50.6 | 15.16 GiB |
| GPT-OSS 20B | 2/13 | 2/13 | 67.4 / 87.4 | 15.55 GiB |

Qwen recovered best after steering, but **none implemented the complete feature correctly**. Gemma and Qwen recovered basic session controls while still missing provider-budget/picker details. GPT-OSS's command errored on an undefined `select`; OmniCoder did not produce a loadable implementation. Production `/effort` was restored afterward. This single SDK-extension task does not supersede the broader coding results.

## Qwen3.8 27B: retain for a larger machine

Tested [Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B) through pinned [Unsloth GGUFs](https://huggingface.co/unsloth/Qwen3.8-27B-GGUF), revision `4ca720788d1e01f1bff70c033e0d0028fd02e502`. Native context is documented as 262144, but useful local throughput is hardware dependent. The model supports vision; our runs were text-only and did not include a projector.

| Quantization | Weight size | Test | Outcome |
|---|---:|---|---|
| UD-IQ4_XS | 14.25 GB | 204800, f16 / q8 cache | Loaded; both timed out during prompt ingestion (about 13–14% processed in ten minutes). |
| UD-IQ4_XS | 14.25 GB | 131072, f16 | Loaded; six-minute timeout, about 15% processed. Remaining intermediate trials were cancelled/unscored. |
| UD-Q3_K_XL | 13.15 GB | 131072, f16 / q8 cache | Loaded; ten-minute timeouts, about 24% / 21% processed. |

Peak total GPU usage was approximately 15.5 GiB. These were **throughput failures**, not demonstrated allocation failures or coding-quality failures. Recall and downstream coding/research/effort quality were unassessed because the required context gate failed. Windows shared-GPU-memory spill was suspected but not confirmed. Both verified weights and scratch files were deleted; the overnight scheduler was removed.

Keep [IQ4_XS](../manifests/qwen38-download.json) and [Q3_K_XL](../manifests/qwen38-next-candidate.json) recipes for the other PC. More available VRAM may help but is not a proven remedy. Verify its actual GPU/memory, re-download one pinned quantization, test 131072 with bounded ingestion first, and only increase toward 204800 after a practical pass. A smaller context could be viable; no blanket rejection of the model family is justified.

## Optional module evidence

- Windows LSP diagnostics/navigation/freshness, hooks, guard behavior, context display, browser fixture and worktree isolation have scripted conformance checks.
- Web extraction/cache/error cases were tested; live DuckDuckGo discovery showed `parse_failed`, so it remains optional.
- A bounded research-tool run used real local inference and public fetches, but source quality was not compared across all models.
- Computer-use is installed as an optional profile; native Windows GUI tasks and image grounding have not passed a completed eval suite here.
- Pi App is optional. Its resident-memory display measures Electron system RAM, not llama.cpp memory or model VRAM. The CLI/API path remains the baseline.

[Machine-readable summary](../results/models.json). Raw session research stays local and ignored. Gemma is a practical starting choice from this sample; repeat on the destination machine rather than treating these numbers as guarantees.
