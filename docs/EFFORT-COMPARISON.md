# Native effort-command task through Pi App

Local date: 2026-10-21. Pi App 0.7.6, Pi SDK 1.3.0, one model and one inference slot at a time. Clean initial context; no unrelated padding. Each model gets one initial prompt and at most one diagnostic follow-up. Scores are independent full-credit pass counts for 13 behavioral checks; there is no weighted total.

| Model | Round 1 score | Round 2 score | Context capacity | Mean generation TPS, R1 | Mean generation TPS, R2 | Peak observed total VRAM, GiB |
|---|---|---|---|---|---|---|
| gemma | 2/13 | 6/13 | 204,800 | 49.2 | 41.6 | 13.44 |
| qwen | 0/13 | 7/13 | 204,800 | 44.3 | 45.1 | 14.30 |
| omnicoder | 0/13 | 0/13 | 204,800 | 55.0 | 50.6 | 15.16 |
| gpt-oss | 2/13 | 2/13 | 131,072 | 67.4 | 87.4 | 15.55 |

This is one harness-extension task, not a broad model-quality benchmark. Generation runs in the actual desktop SDK worker, driven through the app's IPC API. Behavior grading uses fresh real Pi RPC processes and scripted providers, including a scripted GPT-OSS compatibility case; only the selected generation model runs GPU inference. GPT-OSS uses its native 131072-token limit; the other models use 204800.

An initial 32768-context Gemma setup run was stopped and excluded after correcting the context. The scored Gemma run had zero compactions in both rounds. Its verifier stalled after a runtime error in both rounds and was cancelled; the source snapshots were checked unchanged from grading.

The working production effort source is archived during each run and restored afterward. Generated candidates remain separate. Hidden checks and withholding are procedural, not an OS sandbox. Raw sessions, generated source, prompts and detailed traces remain in private ignored artifacts. Round 2 prompts are tailored to Round 1 failures; their content is not identical across models.

TPS is measured from llama.cpp logs and can include candidate-initiated model self-tests. VRAM is sampled total GPU usage, including the desktop/display. Cached-token totals across requests are not unique context occupancy.

## gemma

| Check | Round 1 | Round 2 |
|---|---|---|
| registered | pass | pass |
| arguments | fail | fail |
| no-llm-control-turn | pass | pass |
| session-state | fail | pass |
| session-only | fail | pass |
| picker | fail | fail |
| provider-budget | fail | fail |
| off | fail | fail |
| native-effort | fail | pass |
| bad-input | fail | fail |
| sdk-client | fail | fail |
| resource-isolation | fail | pass |
| verification | fail | fail |

| Metric | Round 1 | Round 2 |
|---|---|---|
| Wall seconds | 560.4 | 529.6 |
| Tool calls | 32 | 6 |
| Compactions | 0 | 0 |
| New input tokens | 100208 | 22802 |
| Cached input tokens | 784620 | 397497 |
| Output tokens | 5683 | 7335 |
| Mean prompt TPS | 833.7 | 1112.0 |
| Weighted generation TPS | 47.8 | 39.8 |

[Structured result](../evaluation/EFFORT-GEMMA-2026-10-21.json).

## qwen

| Check | Round 1 | Round 2 |
|---|---|---|
| registered | fail | pass |
| arguments | fail | fail |
| no-llm-control-turn | fail | pass |
| session-state | fail | pass |
| session-only | fail | pass |
| picker | fail | fail |
| provider-budget | fail | fail |
| off | fail | fail |
| native-effort | fail | pass |
| bad-input | fail | pass |
| sdk-client | fail | fail |
| resource-isolation | fail | pass |
| verification | fail | fail |

| Metric | Round 1 | Round 2 |
|---|---|---|
| Wall seconds | 1475.6 | 575.8 |
| Tool calls | 112 | 32 |
| Compactions | 0 | 0 |
| New input tokens | 83298 | 115406 |
| Cached input tokens | 6449078 | 3931945 |
| Output tokens | 23308 | 19132 |
| Mean prompt TPS | 1222.3 | 1095.3 |
| Weighted generation TPS | 42.6 | 45.0 |

[Structured result](../evaluation/EFFORT-QWEN-2026-10-21.json).

## omnicoder

| Check | Round 1 | Round 2 |
|---|---|---|
| registered | fail | fail |
| arguments | fail | fail |
| no-llm-control-turn | fail | fail |
| session-state | fail | fail |
| session-only | fail | fail |
| picker | fail | fail |
| provider-budget | fail | fail |
| off | fail | fail |
| native-effort | fail | fail |
| bad-input | fail | fail |
| sdk-client | fail | fail |
| resource-isolation | fail | fail |
| verification | fail | fail |

| Metric | Round 1 | Round 2 |
|---|---|---|
| Wall seconds | 589.7 | 1477.1 |
| Tool calls | 63 | 8 |
| Compactions | 0 | 0 |
| New input tokens | 96137 | 110474 |
| Cached input tokens | 2981095 | 790997 |
| Output tokens | 10760 | 7178 |
| Mean prompt TPS | 1657.9 | 1684.0 |
| Weighted generation TPS | 52.7 | 50.4 |

[Structured result](../evaluation/EFFORT-OMNICODER-2026-10-21.json).

## gpt-oss

| Check | Round 1 | Round 2 |
|---|---|---|
| registered | pass | pass |
| arguments | fail | fail |
| no-llm-control-turn | pass | pass |
| session-state | fail | fail |
| session-only | fail | fail |
| picker | fail | fail |
| provider-budget | fail | fail |
| off | fail | fail |
| native-effort | fail | fail |
| bad-input | fail | fail |
| sdk-client | fail | fail |
| resource-isolation | fail | fail |
| verification | fail | fail |

| Metric | Round 1 | Round 2 |
|---|---|---|
| Wall seconds | 490.4 | 486.7 |
| Tool calls | 54 | 36 |
| Compactions | 0 | 0 |
| New input tokens | 23379 | 31638 |
| Cached input tokens | 745128 | 1631922 |
| Output tokens | 7292 | 8085 |
| Mean prompt TPS | 1321.7 | 1418.9 |
| Weighted generation TPS | 68.9 | 84.2 |

[Structured result](../evaluation/EFFORT-GPT-OSS-2026-10-21.json).

Timing caveats: wall seconds include time waiting for approvals. Recorded false-positive host approval waits were excluded from the turn limit; raw wall duration is not generation time. OmniCoder Round 2 required observer recovery after a desktop API timeout, so its reported wall duration includes time before recovery. These durations should not be ranked as model speed. The PowerShell 5/7 guard parser mismatch that caused false approvals was fixed after the four-model batch; guard regressions pass.

Qwen3.8-27B IQ4_XS and Q3_K_XL did not pass the required context-throughput gate. Their effort task was not run, so neither receives a quality score here. See [context results](QWEN38-RESULTS.md).
