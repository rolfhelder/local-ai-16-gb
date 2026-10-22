# Qwen3.8-27B context gate

Retained as a candidate for the other PC: [family notes, pinned downloads and reproduction steps](QWEN38-FAMILY.md). Local weights were subsequently deleted at the user's request; the overnight scheduler was removed.

2026-10-22. Windows, 16 GB VRAM baseline, llama.cpp b11669, one slot, all GPU layers requested, automatic fit off, reasoning enabled. Both Unsloth downloads passed their pinned SHA-256 checks (see manifests).

Neither UD-IQ4_XS nor UD-Q3_K_XL completed the minimum 131072-token capacity trial within its time budget. Models loaded, then prompt ingestion slowed and timed out. This is a practical throughput rejection under these settings, not proof of an allocation failure, native context ceiling, or poor coding ability.

| Quantization | Context capacity | KV cache | Timeout | Last logged prompt progress | Mean prefill TPS at that point | Peak total VRAM GiB |
|---|---:|---|---:|---:|---:|---:|
| UD-IQ4_XS | 204,800 | f16 | 600 s | 14% | 48.9 | 15.50 |
| UD-IQ4_XS | 204,800 | q8_0 | 600 s | 13% | 45.0 | 15.48 |
| UD-IQ4_XS | 131,072 | f16 | 360 s | 15% | 55.9 | 15.55 |
| UD-Q3_K_XL | 131,072 | f16 | 600 s | 24% | 52.4 | 15.48 |
| UD-Q3_K_XL | 131,072 | q8_0 | 600 s | 21% | 45.7 | 15.47 |

The synthetic recall prompt fills approximately 90% of capacity; progress is relative to that prompt. Generation TPS and recall accuracy cannot be assessed when ingestion never completes. IQ4_XS's 131072 f16 trial used the older six-minute bound; both Q3 trials received ten minutes. Cancelled intermediate/remaining IQ4_XS attempts are unscored and retained privately. Windows shared GPU memory could not be reliably measured; spill into system RAM is a hypothesis, not a verified diagnosis.

Per the user's context gate, downstream tool, research, coding and two-round effort evals were not run for these candidates. They are unassessed, not failed quality tests. OmniCoder remains the default. Production effort source was restored; no generated candidate was promoted. Owned inference stopped and the overnight heartbeat was stopped after failure.

[Structured results](../evaluation/QWEN38-CONTEXT-2026-10-22.json). Model sources and pinned hashes: [IQ4_XS](../manifests/qwen38-download.json), [Q3_K_XL](../manifests/qwen38-next-candidate.json).
