# What `pia` runs

`pia` is this repository's launcher, found through user PATH as `bin/pia.cmd`. It runs the portable Node executable on `scripts/pia.mjs`; it is not a separate upstream Pi executable. No shell alias expansion is required.

```powershell
pia --local-model qwen --context 204800
pia --local-model gemma --context 204800
pia --local-model omnicoder --context 204800
# GPT-OSS: after verified download and compatibility tests
pia --local-model gpt-oss --context 131072
pia --local-model qwen --context 131072 --reasoning-budget 4096
pia --profile web
pia --browser
pia --dry-run
```

`--dry-run` prints the exact absolute paths and argument arrays for both child processes on this machine. `--no-reasoning` provides an explicit comparison condition. Reasoning is **on by default**: Pi thinking level `medium`, llama.cpp reasoning budget 2,048 tokens, total generation limit 8,192 tokens at the default **200k (204,800 tokens)** context. `--reasoning-budget` can increase that allowance. Smaller context windows cap output/thinking to leave answer space; compaction reserves the effective generation allowance.

The normal Qwen launch expands to these two processes, with paths read from ignored `machine.local.json` and the portable toolchain:

```text
llama-server.exe --model <Qwen3.5-9B-Q4_K_M.gguf> --alias qwen-local
  --host 127.0.0.1 --port 48763 --jinja --reasoning on
  --reasoning-budget 2048 --fit off --no-context-shift
  -ngl 999 -c 204800 --parallel 1

node.exe <@earendil-works/pi-coding-agent/dist/bundle/cli.js>
  --provider local-llama --model qwen-local --thinking medium
```

For Gemma, the GGUF and alias become `gemma-4-12b-it-Q4_K_M.gguf` and `gemma-local`. The model provider points to `http://127.0.0.1:48763/v1`. Context metadata in Pi matches the requested server slot. An already-running server is refused because its reasoning budget is not exposed by the endpoint and cannot be verified. Another listener is never killed to make room.

The wrapper also regenerates an isolated profile, sets runtime/tool/browser paths, holds the shared inference lock, and stops its owned server/browser after Pi exits. Those steps make `pia` the convenient entry point rather than having to coordinate two terminals. Existing sessions must exit before changing models or launch settings. A new terminal picks up a freshly installed user PATH.

The standard TUI includes an explicit status such as `Context: 8,192 / 204,800 tokens (4.0%) [estimate]`. Pi already provides a compact footer percentage; the added native hook makes absolute usage visible too. Unknown usage after compaction displays `?`, not a misleading zero. The native comparison profile omits extensions to preserve baseline behavior.

OmniCoder uses the verified 9B Q4_K_M file and the same 204,800-token default. GPT-OSS uses the MXFP4 20B file and clamps the requested window to its native 131,072 tokens. `--kv q8_0` explicitly selects quantized K/V cache plus Flash Attention when required by the fit tests; f16 remains the default. Candidate test status and any fallback are documented in [the batch](CANDIDATE-TESTS.md).
