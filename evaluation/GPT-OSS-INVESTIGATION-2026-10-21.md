# GPT-OSS recall setup controls

Same windows, lookup corpus, Pi/llama.cpp and f16 cache. Exact token-budget hook enabled after the initial run. Reasoning remains enabled in every condition; unrestricted thinking still shares an 8,192-token total response cap. Reference sampling uses temperature 1, top-p 1, top-k 0, min-p 0. No fixed seed: these are exploratory controls.

| Condition | Window | Strict recall | Values in answer JSON, diagnostic | No tool calls | Stop reasons | Generation TPS | Peak GPU MiB |
|---|---:|---|---:|---|---|---:|---:|
| initial | 65,536 | FAIL | 0/5 | yes | error | 99.6 | 14176 |
| initial | 131,072 | FAIL | 0/5 | yes | stop | 77.5 | 15776 |
| repaired, 2048 thinking budget | 65,536 | PASS | 5/5 | yes | stop | 93.3 | 14254 |
| repaired, 2048 thinking budget | 131,072 | FAIL | 0/5 | no | toolUse, stop | 58.8 | 15786 |
| repaired, unrestricted thinking | 65,536 | FAIL | 0/5 | yes | stop | 95.3 | 14255 |
| repaired, unrestricted thinking | 131,072 | FAIL | 5/5 | no | toolUse, stop | 66.3 | 15795 |
| repaired, unrestricted + reference sampling | 65,536 | PASS | 5/5 | yes | stop | 81.5 | 14261 |
| repaired, unrestricted + reference sampling | 131,072 | FAIL | 0/5 | yes | stop | 61.8 | 15795 |

Diagnostic values are extracted only from the final answer’s JSON block, ignoring surrounding prose. They do not earn a strict pass. The initial 64k API error hid a correct 5/5 final in the server log; that forensic recovery also earns no pass. See [diagnostic evidence](GPT-OSS-INITIAL-DIAGNOSTIC-2026-10-21.json), [JSON controls](GPT-OSS-INVESTIGATION-2026-10-21.json), and [all four coding models](../docs/CODING-FOUR-MODELS.md).
