# local-ai-16-gb

A practical checklist for running a local coding agent: **Pi + llama.cpp**, with model downloads, a one-command launcher, small extensions and repeatable tests. **Gemma is the default.** No cloud inference account is needed for the core workflow.

## Hardware this was developed for

- **GPU:** NVIDIA GeForce RTX 4090 **Laptop** GPU, 16 GB dedicated VRAM (16,376 MiB reported).
- **System RAM:** 32 GiB. Native Windows; one loaded model and one inference session at a time.
- **Software baseline:** Node 24.22.1, pnpm 12.14.0, Pi SDK/CLI 1.3.0, llama.cpp b11669 (CUDA).
- Aim to fit **weights + context/cache + compute buffers + desktop usage**, not just the GGUF file. Similar VRAM does not imply similar speed. Apple unified memory is shared with the OS and is not equivalent to dedicated VRAM.

Windows is the tested implementation. macOS/Linux instructions and the baseline launcher below are provided, but have not been run on those operating systems. A larger GPU may make rejected models viable; rerun the context test there.

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
  powershell -NoProfile -File scripts/Install-Pia.ps1
  # Open a fresh terminal, then:
  pia --dry-run
  pia
  ```

  `pia` starts the selected model, prepares Pi, and stops its owned server when Pi exits. It refuses overlapping sessions. Defaults: Gemma, 204800 context, reasoning on, 2048 thinking tokens and 8192 total output tokens. Explicit choices: `pia --model qwen`, `pia --model omnicoder`, `pia --model gpt-oss`. Use `--context 32768` for a smaller initial smoke test; GPT-OSS caps at its native 131072.
- [ ] **Run the checks.** `pnpm test` checks local behavior without inference. Then run a small coding smoke test and a context test before trusting a large window. [Test method and commands](docs/TESTING.md).
- [ ] **Add optional features one at a time.** The Windows standard profile includes LSP, explicit context usage, `/effort low|medium|high`, and confirmation for destructive commands; normal commits run automatically. `/effort` is session-only unless explicitly saved. Guardrails are not an OS sandbox. Web/research/browser/computer-use modules are optional and have different evidence levels; see [limitations](docs/MODELS.md).

  Optional Windows desktop app: run `powershell -NoProfile -File scripts/Download-PiApp.ps1`, then `powershell -NoProfile -File scripts/Install-PiAppShortcut.ps1`. Use `pia-app` (Gemma by default) or `pia-app --model omnicoder`. Quit the app from its tray before switching models. `scripts/Setup-Integrations.ps1` installs optional browser/research/GUI helpers; it is not required for the core CLI. Its legacy isolated-profile setup expects `scripts/Initialize-Lab.ps1` to have run first.

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
pia() { node /absolute/path/local-ai-16-gb/scripts/pia-unix.mjs --cwd "$PWD" "$@"; }
```

Then run `pia --dry-run` followed by `pia`. This baseline uses native bash tools, context/effort hooks and the same one-server lifecycle. It does **not** claim Windows LSP, desktop GUI, browser or computer-use parity. The original `.ps1` scripts and GPU eval runners remain Windows-specific.

## Models and measured tradeoffs

![Completed context and coding-run VRAM comparison](assets/model-comparison.png)

Context bars show completed inference capacity, **not reliable retrieval or coding quality**. VRAM bars are sampled total GPU use during coding, including the desktop, at different configured windows. Qwen3.8 27B is omitted from the success bars: IQ4_XS and Q3_K_XL loaded but failed the 131k throughput gate. See [models, coding scores, effort scores and caveats](docs/MODELS.md). Machine-readable observations: [results/models.json](results/models.json).

## What stays local

Model weights, runtimes, credentials, machine configuration, raw sessions, generated eval reports and the session's research diary are ignored. The published guide has three entry points: this checklist, [test methodology](docs/TESTING.md), and [model results](docs/MODELS.md). Pinned install manifests and runnable code remain tracked. Ignoring an earlier tracked report removes it from the current tree; it does not rewrite Git history.
