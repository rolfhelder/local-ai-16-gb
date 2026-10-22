# Install the core local AI stack (Windows)

## 2. Core installer and first-run acceptance

Use PowerShell 7 from a clone. Git and an NVIDIA driver are prerequisites; installing a driver requires a separate OS-level decision. The installer targets Windows x64/CUDA 12.4 and the pinned llama.cpp b11669 build. macOS/Linux setup remains documented in README and is not installed by this script.

```powershell
./scripts/Install-Core.ps1 -Plan   # show actions; no installation
./scripts/Install-Core.ps1         # install core dependencies and register commands
```

Core means Node, pnpm, rg/fd, pinned Pi dependencies and official llama.cpp binaries/runtime. Dependency lifecycle scripts are disabled. Existing machine.local.json is preserved, including an existing verified-version runtime path. Optional GUI/browser/helper assets and GGUF model weights are not downloaded. The project dependency lock includes optional extension packages, but they are not all enabled or loaded.

A new installation writes machine.local.json using paths inside this checkout. If an existing configured runtime is missing or differs from the pinned build, setup stops instead of replacing it. Runtime ZIPs are checksum-verified; partial downloads remain available for resumption. Do not change checksum expectations to accept a failed file. Run installation again only after inspecting its failure. This initial installer has plan/check validation on the development PC; clean-machine acceptance is still pending.

## 2.1 Choose models separately

Download only models you want. These are pinned tested quantizations; quality findings and memory limits are in [model results](MODELS.md). No automatic choice of a larger model is implied by its name.

| Model | Upstream GGUF repository | Pinned download manifest |
|---|---|---|
| Gemma 4 12B IT Q4_K_M (default) | [Unsloth Gemma](https://huggingface.co/unsloth/gemma-4-12b-it-GGUF) | [Gemma recipe](../manifests/gemma-download.json) |
| Qwen3.5 9B Q4_K_M | [Unsloth Qwen](https://huggingface.co/unsloth/Qwen3.5-9B-GGUF) | [Base model recipes](../manifests/models.download-plan.json) |
| OmniCoder 9B Q4_K_M | [Tesslate OmniCoder](https://huggingface.co/Tesslate/OmniCoder-9B-GGUF) | [Coding model recipes](../manifests/coding-model-downloads.json) |
| GPT-OSS 20B MXFP4 | [ggml-org GPT-OSS](https://huggingface.co/ggml-org/gpt-oss-20b-GGUF) | [Coding model recipes](../manifests/coding-model-downloads.json) |

The shared coding manifest includes multiple files. To select only one, copy its entry into a JSON array in an ignored manifests/machine-models.json and pass that filename to the downloader; do not run the entire queue by accident. The downloader expects Repo, Revision, File, Size and SHA256 fields exactly as provided. Gemma has a dedicated single-model recipe:

```powershell
./scripts/Download-CodingModels.ps1 -RateLimit 10M -Manifest gemma-download.json -StatusName gemma-download
# Add -Unlimited only when an uncapped download is wanted.
```

Qwen3.8 27B recipes remain available in the model-results guide, but the tested quantizations failed our minimum practical throughput gate. Treat further offload experiments separately from core installation. Review upstream model licenses/terms for your use.

## Prove the setup works

```powershell
./scripts/Install-Core.ps1 -Check
local-ai doctor --verify-model
node scripts/acceptance.mjs --model gemma        # preview
node scripts/acceptance.mjs --model gemma --run  # real inference, disposable repair
local-ai
```

Acceptance uses a small 32768-token slot, keeps the normal production context unchanged and stops its owned server. It verifies the pinned model hash, endpoint model/context/slots, a real answer and a Pi read/edit/test loop with preserved checks and hidden assertions. Failures stop later stages. Reports and traces stay under ignored .state/acceptance/. The answer and repair stages have separate deadlines; this is a functional smoke check rather than a long-context quality benchmark.

A stopped server is not a doctor failure. Passive live GPU diagnosis requires a launcher-owned startup log and a verified Windows port owner; prior loads are labeled historical. Run `local-ai doctor --check-gpu` for an explicit temporary model load (up to 32k context) that verifies actual layer and buffer placement, then stops its owned server. This does not test the saved 200k context setting. The default doctor does not start a model, install software or modify configuration. The explicit GPU probe writes private run evidence but leaves production settings unchanged. --verify-model explicitly hashes a large file. The normal installation and live acceptance commands do change local assets/start inference; preview and doctor are the read-only choices.

The doctor now defaults to a human-readable terminal report with real paths, status symbols, memory bars and decimal GB units (bytes divided by 1,000,000,000). Use `--json` for scripts, `--public` to hide personal folders, or `--json --public` for a redacted structured export. `--no-color` and `--ascii` support simpler terminals. The result explains unverified live checks and provides next steps.
