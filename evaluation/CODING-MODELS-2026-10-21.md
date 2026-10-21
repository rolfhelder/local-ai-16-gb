# Coding models: first paired trials

Single exploratory runs; compare with the [protocol](../docs/CODING-SUITE.md) and individual artifacts. GPT-OSS is included only after a result artifact exists. Different native windows and KV settings are shown explicitly.

| Model | Status | Window | KV | Clean full passes | 100k full passes | 100k hidden groups | 100k mean generation TPS | Highest GPU MiB |
|---|---|---:|---|---:|---:|---:|---:|---:|
| qwen | complete | 204,800 | f16 | 2/3 | 0/3 | 11/18 | 49.1 | 14453 |
| gemma | complete | 204,800 | f16 | 3/3 | 2/3 | 14/18 | 44.6 | 13468 |
| omnicoder | complete | 204,800 | f16 | 2/3 | 2/3 | 17/18 | 49.0 | 14393 |

Pass requires correct preserved project outputs and normal completion within the six-minute budget. GPU readings include the desktop. Context failure, tool failure, timeout, and wrong-code cases must not be collapsed into a general intelligence claim.
