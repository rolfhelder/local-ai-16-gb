# local-ai-16-gb

A practical checklist for running a local coding agent: **Pi + llama.cpp**, with model downloads, a one-command launcher, small extensions and repeatable tests. **Gemma is the default.** No cloud inference account is needed for the core workflow.

## Hardware this was developed for

- **GPU:** NVIDIA GeForce RTX 4090 **Laptop** GPU, 16 GB dedicated VRAM (16,376 MiB reported).
- **System RAM:** 32 GiB. Native Windows; one loaded model and one inference session at a time.
- **Software baseline:** Node 24.22.1, pnpm 12.14.0, Pi SDK/CLI 1.3.0, llama.cpp b11669 (CUDA).
- Aim to fit **weights + context/cache + compute buffers + desktop usage**, not just the GGUF file. Similar VRAM does not imply similar speed. Apple unified memory is shared with the OS and is not equivalent to dedicated VRAM.

Windows is the tested implementation. macOS/Linux instructions and the baseline launcher below are provided, but have not been run on those operating systems. A larger GPU may make rejected models viable; rerun the context test there.

## Core installer

On Windows, one script installs the non-optional tools; model downloads remain your choice. It provides a preview and a separate real-inference acceptance check.

Follow the [core installation and model-selection guide](docs/INSTALL.md). The manual checklist below explains each component.

## Installation checklist

- [ ] **Install a shell, Git and GPU support.** Windows: PowerShell 7, Git for Windows and an NVIDIA driver; use a CUDA llama.cpp build. macOS: Terminal with zsh/bash and Metal. Linux: bash and an appropriate NVIDIA driver/CUDA toolkit for CUDA builds. See the platform notes below.
- [ ] **Clone the private repository** after `gh auth login`:

  ```sh
  gh repo clone rolfhelder/local-ai-16-gb
  cd local-ai-16-gb
  ```

- [ ] **Install Node/Pi dependencies.** Windows can use the pinned portable bootstrap:

  ```powershell
  powershell -NoProfile -File scripts/Bootstrap-Toolchain.ps1
  . ./scripts/Activate-Tools.ps1
  pnpm install --ignore-scripts --frozen-lockfile
  ```

  On macOS/Linux, install [Node 24 LTS](https://nodejs.org/en/download), then `npm install -g pnpm@12.14.0` and the same `pnpm install` command. Pi is a pinned project dependency; no separate global Pi installation is necessary. [Upstream Pi](https://github.com/earendil-works/pi/tree/main/packages/coding-agent).

- [ ] **Install llama.cpp.** Keep this runtime on every OS; no replacement is needed. Windows: extract the official b11669 CUDA binary and matching runtime archives into one local tools directory; exact URLs/hashes are in [the runtime manifest](manifests/llama-observed-assets.json). macOS/Linux alternatives are below. Binaries are deliberately not in Git.
- [ ] **Create `machine.local.json`.** Windows: copy `config/machine.example.json`; macOS/Linux: copy `config/machine.posix.example.json`. Set absolute `LlamaExecutable` and `ModelsDirectory` paths. Keep the endpoint on `127.0.0.1:48763`. This file is ignored by Git. Windows' `PiExecutable` should point to this clone's `node_modules/.bin/pi.cmd`; the main launcher invokes the pinned Node-based CLI directly.
- [ ] **Download one model.** Start with Gemma 4 12B IT Q4_K_M. Preserve the repository/filename layout from [the Gemma manifest](manifests/gemma-download.json). Windows:

  ```powershell
  powershell -NoProfile -File scripts/Download-CodingModels.ps1 -RateLimit 10M -Manifest gemma-download.json -StatusName gemma-download -Unlimited
  ```

  This verifies pinned size/SHA-256; `-Unlimited` removes the speed cap. macOS/Linux: download that manifest's revision/file using `curl -fL -C - -o FILE URL`, then compare `shasum -a 256 FILE` (macOS) or `sha256sum FILE` (Linux) to its SHA-256. Put it under `ModelsDirectory/unsloth/gemma-4-12b-it-GGUF/`. No image projector is required for text.
- [ ] **Register one-command startup.** Windows:

  ```powershell
  powershell -NoProfile -File scripts/Install-LocalAI.ps1
  # Open a fresh terminal, then:
  local-ai --dry-run
  local-ai
  ```

  `local-ai` starts the selected model, prepares Pi, and stops its owned server when Pi exits. It refuses overlapping sessions. Defaults: Gemma, 204800 context, reasoning on, 2048 thinking tokens and 8192 total output tokens. Explicit choices: `local-ai --model qwen`, `local-ai --model omnicoder`, `local-ai --model gpt-oss`. Use `--context 32768` for a smaller initial smoke test; GPT-OSS caps at its native 131072.
- [ ] **Run the checks.** `pnpm test` checks local behavior without inference. Then run a small coding smoke test and a context test before trusting a large window. [Test method and commands](docs/TESTING.md).
- [ ] **Choose optional extensions or a desktop interface** after the core CLI works. The guides below explain their setup and evidence limits.

## macOS / Linux equivalents

[llama.cpp supports macOS and Linux](https://github.com/ggml-org/llama.cpp/blob/master/docs/install.md). On macOS with Homebrew:

```sh
brew install git llama.cpp ripgrep fd
command -v llama-server
```

On Linux with an NVIDIA GPU, install Git, CMake, a C++ compiler and the [CUDA toolkit](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md), then build (example layout):

```sh
git clone --depth 1 --branch b11669 https://github.com/ggml-org/llama.cpp "$HOME/.local/src/llama.cpp"
cmake -S "$HOME/.local/src/llama.cpp" -B "$HOME/.local/src/llama.cpp/build" -DCMAKE_BUILD_TYPE=Release -DGGML_CUDA=ON
cmake --build "$HOME/.local/src/llama.cpp/build" --config Release -j
```

macOS uses Metal; Linux NVIDIA uses CUDA. Other GPU backends exist upstream but were not tested here. Install `rg` and `fd` on PATH too (some Linux distributions name the latter `fdfind`). Homebrew installs its current build, so record that version; do not assume our b11669 measurements transfer unchanged.

After configuring native paths and downloading a model, add this function to `~/.zshrc` (macOS) or `~/.bashrc` (Linux), replacing the clone path:

```sh
local-ai() { node /absolute/path/local-ai-16-gb/scripts/pia-unix.mjs --cwd "$PWD" "$@"; }
```

Then run `local-ai --dry-run` followed by `local-ai`. This baseline uses native bash tools, context/effort hooks and the same one-server lifecycle. It does **not** claim Windows LSP, desktop GUI, browser or computer-use parity. The original `.ps1` scripts and GPU eval runners remain Windows-specific.

## Models and measured tradeoffs

![Completed context and coding-run VRAM comparison](assets/model-comparison.png)

Context bars show completed inference capacity, **not reliable retrieval or coding quality**. VRAM bars are sampled total GPU use during coding, including the desktop, at different configured windows. Qwen3.8 27B IQ4_XS and Q3_K_XL loaded but failed the 131k throughput gate.

Read the [model comparison](docs/MODELS.md) for the hardware tradeoffs. The [evaluation guide](docs/TESTING.md) explains occupancy, recall failures, deadlines and the complete recorded results behind this chart.

## Evaluations: what to expect

Small repair tasks favored Gemma overall, but all four models struggled to implement a native effort command. A large usable allocation does not mean dependable reasoning across that window. We test harness behavior, filled context, clean versus padded coding, and a two-round extension task separately.

The [evaluation guide and results](docs/TESTING.md) includes failures, per-round scores, limitations and reproduction commands.

## Pi extensions and configuration

The standard Windows profile adds context usage, effort control, destructive-command approvals and LSP. Web search, research, browser automation and computer use remain independent optional profiles with different levels of validation. Keep the tool surface small and add one feature at a time.

See [extensions, hooks and guardrails](docs/EXTENSIONS.md) for configuration, researched alternatives and evidence.

## Optional desktop interface: Pi App

Prefer a window to a terminal? Pi App can connect to the same local llama.cpp model through our launcher, with an effort picker and side panels. It is optional; the CLI setup above is sufficient.

Follow the [Pi App setup guide](docs/PI-APP.md) for installation, the local endpoint, SDK compatibility, thinking budgets and model switching.

## One-command startup

Use **`local-ai`** for the CLI or **`local-ai-app`** for the optional Windows app. Both select Gemma by default; `--model qwen|gemma|omnicoder|gpt-oss` chooses another downloaded model. The CLI accepts `--context`; the app takes its context from the model/machine configuration. The launchers start llama.cpp, prepare Pi and clean up their owned server. Old `pia` / `pia-app` commands remain compatibility aliases.

## What stays local

Model weights, runtimes, credentials, machine configuration, personal prompts, raw sessions and research notes are ignored. Sanitized measured results are published under `results/`; the 105-repository research ledger stays local. Pinned install manifests and runnable code remain tracked. Removing an earlier tracked file does not rewrite Git history.
