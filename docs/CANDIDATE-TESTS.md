# OmniCoder and GPT-OSS test batch

2026-10-21. The user authorized immediate OmniCoder tests and GPT-OSS tests after its download. This is one finite sequential job, not a recurring automation or subagent. The hidden Node worker survives the current chat turn; its private status is `.state/candidate-queue.json`, and its sanitized progress snapshot is [CANDIDATE-QUEUE-2026-10-21.json](../evaluation/CANDIDATE-QUEUE-2026-10-21.json). Phase `complete` means the attempts ended, not that every test passed; inspect child exit codes and result artifacts.

## Protocol

1. Wait for a final model file, then independently check its pinned size and SHA256. `.part` files never qualify.
2. Read the GGUF native context. Test loading at min(200k, native window), all GPU layers, one slot, reasoning on, fit off and no context shift. Sample total GPU memory. Try f16 KV first; if it cannot load, record the failed attempt and try q8_0 KV with Flash Attention. If neither loads, stop that model's high-context tests and record the unsupported configuration. No CPU-offload or context reduction is silently substituted.
3. Run the 32k read/edit/test/retest fixture. OmniCoder's identical smoke check already passed before the batch: 21.9 seconds, 75.5 generation tokens/s, original tests preserved, initial failure reproduced and rerun successful. GPT-OSS receives the same check after downloading.
4. Run three [coding projects](CODING-SUITE.md), each clean and with exactly 100,000 unrelated background tokens. Reasoning budget 2,048; response cap 8,192; six-minute agent limit. Fresh projects and sessions, same graders, no intervention. Disable compaction for the new candidate runs so a 128k window cannot silently discard background. Input usage must retain the prefix; overflow remains a recorded failure.
5. Run exact five-code recall at 64k/128k/200k for OmniCoder and 64k/128k for GPT-OSS, approximately 90% prompt fill, word-shaped codes and the existing synthetic record generator. These are recall stress tests, separate from coding. Do not claim a VRAM maximum from the selected window sizes.

All inference scripts acquire the same lock as `pia`. Waiting for a download does not hold that lock; the batch waits if an interactive session is using it. The download worker remains independent and bandwidth-limited. The test job waits at most four hours for each file; process errors and failed steps remain in its status rather than being interpreted as passing scores.

GPT-OSS's native window is 131,072 rather than 204,800. Its MXFP4 weight format, any q8 cache fallback and smaller context must be shown when comparing it with Qwen/Gemma/OmniCoder. Its Harmony/tool compatibility is measured by the smoke fixture, not assumed from server startup. If the target context cannot load at either cache precision, high-context tests are recorded as unsupported rather than run with a different task.

## Artifacts and commands

The baseline [Qwen/Gemma result](../evaluation/CODING-CONTEXT-2026-10-21.md) is preserved. Candidate coding exports use separate names: `evaluation/CODING-CONTEXT-OMNICODER-2026-10-21.*` and `evaluation/CODING-CONTEXT-GPT-OSS-2026-10-21.*`. Private traces and per-step logs live under ignored `.state/evals/candidates-*`. Recall trials remain in `.state/evals/limits-*`; candidate-specific exports use `evaluation/CONTEXT-OMNICODER-2026-10-21.json` and `evaluation/CONTEXT-GPT-OSS-2026-10-21.json`. `node evals/audit-limits.mjs` also updates the combined sanitized history after completion. The smoke-check exporter includes all matching `coding-<timestamp>` runs without confusing them with project-suite or preflight folders.

The GPT-OSS download's long open-ended CDN response slowed to a trickle. A 16 MiB range probe was healthy, so the downloader now resumes with sequential 32 MiB ranges. Only complete ranges are appended, and final size/SHA256 still gate test startup. Both per-request throttling and whole-file pacing enforce the same measured 35% bandwidth allowance; range retries do not create parallel transfers.

```powershell
Get-Content .state\candidate-queue.json
Get-Content .state\candidate-queue.stderr.log
Get-Content .state\coding-downloads.json
pia --model omnicoder
# After download and compatibility checks:
pia --model gpt-oss
# Only if the test report selected the cache fallback:
pia --model gpt-oss --kv q8_0
```

Do not launch a second batch while the worker owns `.state/candidate-queue.lock`. To reproduce from scratch after it ends, `node evals/candidate-queue.mjs` runs one new batch; it does not resume previous test steps. All selected weights and binaries remain outside Git.

## Completed OmniCoder results

The 200k f16 configuration loaded successfully. All six coding trials ended normally: clean 2/3 full passes and 17/18 withheld groups; with 100k unrelated tokens, 2/3 full passes and 17/18 groups. Pagination missed one group in each condition. Mean generation was 71.6 TPS clean and 49.0 TPS loaded; highest sampled GPU memory was 14,393 MiB, including the desktop. See the [per-case results](../evaluation/CODING-CONTEXT-OMNICODER-2026-10-21.md) and [model comparison](../evaluation/CODING-MODELS-2026-10-21.md).

Exact recall passed 5/5 at every tested window: 65,536 (58.33 TPS, 9,856 MiB), 131,072 (47.03 TPS, 11,968 MiB), and 204,800 (38.87 TPS, 14,349 MiB). Actual prompt occupancy was about 90%; these are selected operating points, not allocation failure boundaries. [Recall evidence](../evaluation/CONTEXT-OMNICODER-2026-10-21.json). One run per condition is exploratory evidence, not a stable model ranking. GPT-OSS subsequently downloaded, verified and completed its initial batch at 18:09 local time. Its initial 100k coding trials were invalidated by a one-token output clamp; see [the investigation and four-model results](CODING-FOUR-MODELS.md). Initial candidate artifacts are retained in evaluation/archive.
