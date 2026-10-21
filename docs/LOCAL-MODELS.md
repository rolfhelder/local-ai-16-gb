# Local model operating playbook

Runtime update: the lab now uses Node-based Pi 1.3.0 because the standalone executable exited silently with Pi Research during extension loading. See [installed stack](INSTALLED-STACK.md). The llama.cpp and model-sizing guidance remains unchanged.

## Baseline and sizing

Use **16 GB VRAM** as the present bottleneck. Target-PC RAM was reported as 32 GB; current-PC RAM and both actual GPU memory totals should be measured before tuning. The destination's reported 24 GB is not needed to run the baseline.

The existing download manifest queues Qwen3.5-9B Q4_K_M (~5.68 GB weights, decimal) and Gemma 4 12B Q4_K_M (~7.12 GB), each with an mmproj file. These are existing candidates, not a claim that they are today's best models. Start with Qwen to avoid another download and compare Gemma later using identical tasks. [Qwen quantization source](https://huggingface.co/unsloth/Qwen3.5-9B-GGUF).

Weight size is only part of memory use. Leave room for runtime buffers, attention/recurrent state, vision processing, desktop VRAM use, and the loaded context. The architecture, quantization, cache precision and number of slots all matter. A nominal 100k context specification does not prove that 100k fits in available memory or is useful for research.

Initial experiment: 16,384 context tokens, one slot, one loaded model. If stable, test 32,768 on the same tasks. Increase only after recording memory and latency. This is a conservative starting experiment, not a fit guarantee. On a later 24 GB machine, rerun the measurements before selecting a larger model or longer context.

## Native integration first

The launcher starts llama.cpp in router mode: no `-m` or `-hf`; a model directory, `--no-models-autoload`, `--models-max 1`, `--jinja`, loopback binding, explicit context and one parallel slot. In Pi, configure `/login llama.cpp`, load through `/llama`, then select through `/model`. Keep the provider base URL at `http://127.0.0.1:8080`, without `/v1`, for this native router workflow. [Pi llama.cpp guide](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/llama-cpp.md).

If the router cannot be used, a separate `models.json` OpenAI-compatible configuration is a fallback. Its Chat Completions base usually ends in `/v1`; its model ID must match the server. Do not apply the fallback's URL conventions to the native router setup. Configure the advertised context to match the server allocation. [Compatible endpoint reference](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md).

The installed b11669 build recognizes the launch flags, but its CUDA 12.4 asset has not been inference-tested here. Do not assume that copying the same backend build is optimal for a different GPU generation. Validate a suitable llama.cpp backend and driver on each PC; preserve the working version/hash afterward. [Builds](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md), [server reference](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).

## Tool use before intelligence benchmarks

Jinja templates and the model's tool-call format must agree with llama.cpp's parser. Test a real read → edit → command → correction cycle through Pi. A conversational answer or a raw JSON response alone does not establish agent capability. If tool names appear in prose, arguments are malformed, or a model invents tool output, inspect template/parser compatibility before adding extensions. [llama.cpp function calling](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md).

Keep the model's tool surface small initially. Native read, PowerShell, edit/write and file discovery are enough for the coding baseline. MCP `direct` exposure is easier to inspect but uses prompt space; `deferred` requires tool discovery; `codemode` requires writing scripts. Compare these rather than assuming the fewest declared tools always produces the best result. The disabled Playwright example starts with deferred exposure. [MCP exposure](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/mcp.md).

## Context and compaction

**Measured update (2026-10-21):** Qwen's completed Q4_K_M hash matches the download plan. Real Pi recall trials passed at 8k, 16k, 32k, 64k and 102,400 context settings, including a 94,460-token prompt at about 10.3 GiB sampled total GPU use. Native read/edit also passed. See EVALS.md for raw usage interpretation and limits. `pia` now manages the direct local endpoint, model selection and cleanup; start with its 32k default and use `--context 102400` deliberately. The older router instructions below are an alternative, not required for `pia`.

The inspected Pi 1.3.0 defaults reserve 16,384 tokens and retain 20,000 recent tokens, which are unsuitable starting values for a 16k experiment. The starter uses reserve 4,096, recent 6,000, and branch-summary reserve 4,096. These are lab choices, not model-vendor tuning recommendations. Bound tool output, keep research evidence on disk, and verify that the model metadata reports the actual available context. [Compaction reference](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/compaction.md).

Long thinking consumes output budget and time. Start with short bounded tasks, preserve the model author's recommended sampling parameters, and change one parameter at a time. Do not copy temperature/reasoning presets across architectures without evidence.

## Vision and audio

A multimodal model needs the correct projector and server support; a GGUF filename alone is insufficient. Test a known local screenshot with small text, then a harmless GUI task. Semantic desktop and browser trees can reduce reliance on image grounding, but cannot describe canvas content or arbitrary visual layout fully. Load a vision-capable configuration only when needed; keep mmproj associated with the exact model revision.

For missing video captions, run speech recognition separately. Scheduling transcription and LLM generation sequentially avoids another concurrent GPU workload. [whisper.cpp](https://github.com/ggml-org/whisper.cpp) supports local transcription; the included research does not install its runtime or choose an audio model.

## Troubleshooting order

| Symptom | Check first |
|---|---|
| Executable missing | `machine.local.json` and full extraction including DLLs |
| DLL/CUDA error | Driver/backend compatibility; do not keep retrying a wrong binary |
| No models listed | Completed `.gguf` rather than `.part`; router directory layout; restart router |
| No model in Pi picker | Load with `/llama`; inspect `/models` and `/mcp` separately |
| Out of memory | Unload other models; lower context, vision resolution, slots; consider fewer GPU layers |
| Tools printed as text | Model template, tool parser, schema and Pi endpoint compatibility |
| Endless compaction | Accurate context metadata; reserve/recent values; smaller tool results |
| Slow after many pages | Prompt length, cache reuse, CPU offload, context pressure |
| Child uses cloud model | Explicit model IDs in agent files, inherited settings and provider selection |
| Web tools unavailable | Isolated profile needs its own package declarations/config; old global settings aren't inherited |

`PI_OFFLINE=1` in the launcher disables automatic Pi network activity. It is not a firewall and does not prevent web extensions, MCP servers, or shell commands from using the internet. Inference stays local only while the selected provider and all secondary model/summarizer settings remain local.
