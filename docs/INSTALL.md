# Install the core local AI stack (Windows)

## 2. Core installer and first-run acceptance

From a fresh clone, use `.\bin\local-ai.cmd install --plan` and `.\bin\local-ai.cmd install` until the command is registered in PATH. This entry point works before Node is installed. Use PowerShell 7 for installation. Git and an NVIDIA driver are prerequisites; installing a driver requires a separate OS-level decision. The installer targets Windows x64/CUDA 12.4 and the pinned llama.cpp b11669 build. macOS/Linux setup remains documented in README and is not installed by this script.

```powershell
local-ai install --plan  # show actions; no installation
local-ai install         # open the setup and first-run menu
local-ai install --run   # install directly; skip the menu
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

## Setup menu

Run `local-ai install` and choose installation, inventory, real acceptance, or model checksum/health. Nothing installs or loads merely by opening the menu. Choose `0` to exit. Acceptance and doctor list installed GGUF models, automatically selecting only when exactly one is found. With several models, choose a number or enter a full GGUF path. `--model omnicoder` skips selection. Projector files and split shards are excluded from automatic discovery; a split model can be selected explicitly by its first shard path. Direct alternatives remain available: `local-ai install --plan`, `--check`, `--run`, `--test` (acceptance preview), and `--test --run` (real acceptance). `local-ai test --run` remains a shortcut.

## Preview, inventory and health are different

`local-ai install --plan` previews installation in a human-readable dashboard. `local-ai install --check` inventories core files, Node/pnpm/Pi versions, the configured llama.cpp build and launcher registration. Both modes are read-only and load no model. Add `--json` for automation or `--no-color --ascii` for plain terminals. The inventory does not run the doctor.

`local-ai doctor` checks hardware, model configuration and runtime health. Acceptance loads a model and asks Pi to answer and repair code. Passing inventory alone does not prove inference works.

## Prove the setup works

`local-ai test` previews the checks. Add `--run` for the live dashboard: completed-check progress, an animated active step and moving bar highlight, elapsed time, measured SHA256 reading progress in GB, and a final pass/fail summary with the report path. Loading and coding indicators show activity rather than an estimated percentage. Redirected output uses periodic plain-text updates. Use `--json` for machine-readable output (no dashboard), `--no-color` to disable colors, or `--ascii` for basic symbols.

```powershell
local-ai install --check
local-ai doctor --verify-model
local-ai test                        # preview
local-ai test --run                  # choose an installed model, then test
local-ai test --model omnicoder --run # choose another installed model
local-ai
```

Acceptance uses a small 32768-token slot, keeps the normal production context unchanged and stops its owned server. It verifies the pinned model hash, endpoint model/context/slots, a real answer and a Pi read/edit/test loop with preserved checks and hidden assertions. Failures stop later stages. Reports and traces stay under ignored .state/acceptance/. The answer and repair stages have separate deadlines; this is a functional smoke check rather than a long-context quality benchmark.

A stopped server is not a doctor failure. Passive live GPU diagnosis requires a launcher-owned startup log and a verified Windows port owner; prior loads are labeled historical. Run `local-ai doctor --check-gpu` for an explicit temporary model load (up to 32k context) that verifies actual layer and buffer placement, then stops its owned server. This does not test the saved 200k context setting. The default doctor does not start a model, install software or modify configuration. The explicit GPU probe writes private run evidence but leaves production settings unchanged. --verify-model explicitly hashes a large file. The normal installation and live acceptance commands do change local assets/start inference; preview and doctor are the read-only choices.

The doctor now defaults to a human-readable terminal report with real paths, status symbols, memory bars and decimal GB units (bytes divided by 1,000,000,000). Use `--json` for scripts, `--public` to hide personal folders, or `--json --public` for a redacted structured export. `--no-color` and `--ascii` support simpler terminals. The result explains unverified live checks and provides next steps.

Custom GGUF files use a conservative 32768-token test configuration. Their actual native context, chat template, reasoning and tool support still need model-specific validation; discovery is not compatibility certification. A model without a pinned manifest receives a computed SHA256 fingerprint, clearly labeled as unverified download integrity. Doctor shows measured percent/GB read during checksum work and an activity bar while inspecting hardware/runtime; checksum verification does not load weights into VRAM.
