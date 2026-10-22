# Pi App local setup

Configured 2026-10-21 for portable Pi App 0.7.6, using the same pinned Pi SDK 1.3.0 as the CLI. The [upstream application](https://github.com/justhil/pi-app/tree/v0.7.6) normally reads the default Pi agent directory and bundles SDK 1.0.2; the desktop launcher instead supplies our isolated profile and a supported user-SDK entry.

## Install the optional app

First finish the core README checklist, including the local model and machine.local.json. Then, from this checkout:

```powershell
powershell -NoProfile -File scripts/Download-PiApp.ps1
powershell -NoProfile -File scripts/Install-LocalAI.ps1
powershell -NoProfile -File scripts/Install-PiAppShortcut.ps1
# Optional: recreate configuration without starting inference
node scripts/pi-app.mjs --configure-only --model gemma --cwd C:/path/to/project
```

The downloader verifies the pinned manifest checksum. The configuration step writes the supported user SDK selection under %APPDATA%/pi-desktop and backs up prior settings under ignored .state/pi-app-backups. It must be repeated after moving the checkout to another PC. No cloud API key is required for the local endpoint.

## Start and connect

Launch **Pi App** from Start, or run:

```powershell
local-ai-app
local-ai-app --model gemma
local-ai-app --model qwen
local-ai-app --model gpt-oss
```

The Start shortcut runs `scripts/Start-PiApp.ps1`; `scripts/pi-app.mjs` prepares `.state/profiles/pi-app`, starts one llama.cpp model on loopback port 48763, launches the portable GUI, and stops its owned server after the app quits. Gemma is the default. The selected model's native limit caps the context; the usual 204800 default applies except GPT-OSS (131072). `--cwd PATH` selects a project; otherwise the last project is retained, initially the Code directory.

Quit the current Pi App from its tray before changing models. Closing the window may leave it running in the tray. The desktop model list exposes only the loaded alias: selecting a name in a GUI cannot itself load a different GGUF. The shared inference lock prevents launching another owned CLI/eval server at the same time. `--attach` is an explicit advanced option for a matching existing server; it does not take ownership, and its original owner must remain open.

## Thinking, tools and context

- Built-in effort picker changes session thinking state. The native effort extension maps it to real request budgets: off 0, low 512, medium 2048, high 4096, with 8192 total output tokens by default. Model capability distinctions and explicit saved defaults are documented in [effort controls](EXTENSIONS.md#context-usage-and-effort).
- Default desktop worker setting is one, with five-minute idle reclamation. llama.cpp has one inference slot. No subagent or plan modules are installed into this profile.
- Windows PowerShell tools, destructive-command approval adapters and Windows-adapted TypeScript LSP carry over. Desktop extension confirmations use the app's native UI bridge; unattended RPC remains blocked for destructive commands.
- Files, Run, Context and the experimental built-in Browser panel are enabled. Browser agent control remains opt-in per session; Playwright CLI remains the chosen coding/browser automation interface. A browser panel does not itself add browser tools to every prompt.
- Compaction reserves output space and keeps recent context. Inspect the Run/Context panels for usage. Search/research/computer-use modules remain separate trials rather than an expanded default tool surface.
- Version checks are disabled in this pinned setup. Audio/ASR and vision are not configured; do not assume the default microphone provider is local or independent of a subscription.

Pi App 0.7.6 reads legacy `modelId`/`maxOutput` fields in portions of its worker. A small local SDK-entry adapter supplies aliases for SDK 1.3.0's canonical `id`/`maxTokens`; it does not modify the packaged EXE or replace request logic. Review this adapter when upgrading either component. The SDK entry under the app's user-data folder references this checkout; regenerate it after moving PCs.

## Validation and restore

The no-inference desktop smoke check verified model visibility, 200k context, 8192 output cap, SDK 1.3.0 without fallback, command registration, the built-in effort switch, and Browser panel configuration. Separate real-Pi RPC checks verified actual 4096/512 request budgets against a scripted endpoint. These checks do not establish model coding quality or every desktop feature's task quality.

`scripts/pi-app.mjs --configure-only` recreates the profile and supported SDK entry. `Download-PiApp.ps1` restores the pinned EXE, and `Install-PiAppShortcut.ps1` recreates the Start shortcut. Previous app settings/SDK selections are backed up under ignored `.state/pi-app-backups` before each configuration pass. No credentials or session transcripts belong in Git.

The effort-command coding task is separately defined in `evals/tasks/create-effort-command.json`. It uses a disposable sibling project, a separate agent directory and production context capacity: 204800 tokens except GPT-OSS's native 131072. It starts with clean context, without unrelated padding. The working effort source is temporarily archived away from its normal paths and has a separate hashed backup; `evals/withhold-effort-source.mjs --restore` restores it afterward. One diagnostic follow-up is allowed. Round 1 and Round 2 have independent full-credit score columns, with per-check passes and regressions preserved; there is no weighted total. Each turn is bounded at 15 minutes, and a Pi CLI verifier stalled over five minutes is stopped. No generated candidate is automatically promoted. An earlier 32768-context Gemma setup run was excluded, not scored against the model. See [the full evaluation results](TESTING.md#recorded-results-and-limits).

## Context settings and memory display

The launcher configures both ends: llama.cpp's slot capacity and Pi's models.json contextWindow. Change machine.local.json / model configuration and relaunch through the launcher rather than editing only the app's reported limit. GPT-OSS is capped at its native 131072; other tested launch defaults are 204800. An app effort switch changes generation effort, not context allocation.

The Resident memory display sums physical RAM used by Electron processes. It excludes the separate llama.cpp process and GPU VRAM. Its GPU-process label describes Electron process RAM, not model VRAM, so small fluctuations while inference fills VRAM are expected. Use NVIDIA's nvidia-smi / OS GPU metrics for total dedicated GPU memory.

Keep the endpoint on loopback; remote and Chrome bridge integrations are disabled. Files/Run/Context/Browser panels are enabled, one worker and five-minute idle reclamation are selected, and automatic registry updates are disabled for the pinned SDK. Audio/vision and remote features require separate validation. The terminal's custom context footer is not a promise of identical desktop status rendering.
