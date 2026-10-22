# Pi Local Lab

A portable Windows research notebook and starter configuration for Rolf's move from subscription coding agents to Pi + local models.

Research date: **2026-10-21**. Baseline: **16 GB VRAM**, one inference slot, native Windows. Qwen3.5-9B Q4_K_M and Gemma-4-12B-IT Q4_K_M both loaded a **262,144-token context** and processed roughly **235,000 prompt tokens**. The default is **200k (204,800 tokens)** for both to leave more VRAM headroom. Exact recall and coding results are separate measurements; see [the model comparison](docs/CONTEXT-COMPARISON.md).

For this context-heavy workflow, the current provisional recommendation is **OmniCoder**, with **Gemma** as the general-coding and lower-memory alternative. GPT-OSS is fastest but uses more VRAM and showed protocol failures. See [the full four-model comparison and verdict](docs/MODEL-VERDICT.md). Plain `pia` and `pia-app` now default to **Gemma**, by user choice; the comparison remains historical evidence.

The October 22 Qwen3.8-27B IQ4_XS and Q3_K_XL trials loaded but timed out during long-prompt ingestion, failing the required 131072-context throughput gate under the tested settings. Their coding quality remains unassessed. See [Qwen3.8 context results](docs/QWEN38-RESULTS.md) and the [four-model effort-command comparison](docs/EFFORT-COMPARISON.md).

## Run it

Qwen3.8's tested weights were removed after the failed local context gate. [Family notes](docs/QWEN38-FAMILY.md) preserve the candidates and reproduction steps for the more powerful PC.

Open a new terminal and type `pia`. It starts the selected local llama.cpp model, prepares the isolated profile, launches Pi and stops its owned server after Pi exits. Default: **200k context**, text-only Gemma, destructive-action guard and Windows-adapted TypeScript LSP. Ordinary commits run automatically. One shared inference lock prevents overlapping sessions. No login or manual model selection is required.

Reasoning is **on by default**, with a 2,048-token thinking budget and up to 8,192 total generated tokens. The endpoint is **127.0.0.1:48763**. Pi shows explicit used/total context tokens in its status line. See [the full launcher commands](docs/LAUNCHER.md); `pia --dry-run` prints the exact local paths and argument arrays.

```powershell
pia
pia --model qwen
pia --model gemma
pia --model omnicoder
pia --model qwen --context 131072
pia --context 102400
pia --profile native
pia --profile research --context 102400
pia --profile desktop
pia --profile web
pia --browser
pia --cwd C:\path\to\your\project
pia --dry-run
```

Research and desktop tools are optional profiles. Research defaults to one quick pass, one query, two scraped URLs and BM25 retrieval; deep teams and standalone subagent modules are not enabled. `--browser` opens a separate headed Edge window through Playwright CLI. An embedded desktop browser is researched separately. Images/projectors and audio transcription are not enabled by this launcher.

## Read first

- [Research and recommended stack](docs/RESEARCH.md): ranked modules, tradeoffs, and sources.
- [Claude Code feature map](docs/CLAUDE-CODE-MAP.md): what is built in, what to add, and what remains different.
- [Local model playbook](docs/LOCAL-MODELS.md): inference, context, tools, vision, and troubleshooting.
- [Research-to-learning workflow](docs/LEARNING-WORKFLOW.md): build a source-backed personal knowledge library.
- [Windows setup and migration](docs/WINDOWS-MIGRATION.md): rebuild on another PC and prepare for the sale.
- [Validation and next experiments](docs/VALIDATION.md): honest evidence levels and acceptance tasks.
- [Ordered next steps](docs/NEXT-STEPS.md): what to do after this research pass.
- [Installed stack and commands](docs/INSTALLED-STACK.md): pnpm, Playwright CLI, Research and computer use.
- [Architecture study](docs/ARCHITECTURE-RESEARCH.md): March 2026 Claude Code source, Hermes and Grok Bot.
- [Hooks, permissions, worktrees and browser UI](docs/HOOKS-AND-ISOLATION.md).
- [Existing harnesses and LSP comparison](docs/EXISTING-HARNESSES.md).
- [Automated evals and measured local results](docs/EVALS.md).
- [Qwen versus Gemma: context, VRAM, speed and exact recall](docs/CONTEXT-COMPARISON.md).
- [Coding-agent comparison with clean and 100k unrelated context](docs/CODING-SUITE.md): Gemma finished more tasks correctly in the first paired run; Qwen generated faster. Includes the throttled OmniCoder/GPT-OSS download queue.

## Recommendation

Start with `pia` and small sequential tasks. Add search, transcript retrieval, browser automation and Windows computer use in separate trials. Save Markdown evidence batches for learning and software work. No subagent or plan-mode modules are needed.

The installed research candidate is [@lincoln504/pi-research](https://github.com/Lincoln504/pi-research), browser automation uses [Playwright CLI](https://github.com/microsoft/playwright-cli), and Windows computer use uses [@injaneity/pi-computer-use](https://github.com/injaneity/pi-computer-use).

**Setup update:** pinned portable Node/pnpm, Pi 1.3.0, Playwright CLI, Research, computer use, pi-guard and LSP are installed. Combined guard/LSP passes 9/9 current checks; native Pi passes 3/9, exposing the intended gaps. Browser automation passes local DOM/session checks. Research completed one real local quick-mode trial but failed the initial synthesis-quality audit. Desktop action quality, transcripts and ASR remain unvalidated. No cloud model or paid search service is configured; web tools contact websites/search engines.

## Starter commands

From this folder, use PowerShell:

```powershell
.\scripts\Initialize-Lab.ps1
.\scripts\Bootstrap-Toolchain.ps1
.\scripts\Setup-Integrations.ps1
.\scripts\Install-Pia.ps1
. .\scripts\Activate-Tools.ps1
.\scripts\Test-Lab.ps1
.\bin\pia.cmd --dry-run
pnpm test
pnpm eval:hooks
pnpm eval:tools
```

Initialization creates ignored `machine.local.json` and `.state/agent/settings.json`. It detects existing sibling `local-ai` assets, or uses ignored `runtime/` and `models/` directories on a new machine. Bootstrap downloads checksum-verified Node and locked pnpm. Integration setup restores locked packages and browser/helper assets, installs the official Playwright skill into the isolated profile, and selects Node-based Pi. The Research browser download is about 1.3 GB. Edit `machine.local.json` for the model/server paths on the new machine.

`pia` is the primary launcher. The older `Start-Llama.ps1` / `Start-Pi.ps1` router workflow remains an advanced alternative; it requires manual login/load/selection and should not run alongside `pia`. On a moved clone, regenerate local state using setup and register the new `bin` path. Model weights and llama.cpp binaries must be copied/restored separately; they are not in Git.

`pia` generates separate profiles under `.state/profiles/`. It preserves your personal Pi settings and sets tool/browser/model paths for its child process. Browser work uses CLI, and computer use's browser bridge is disabled. The raw `native`, `guard-module` and `lsp` profiles preserve comparison points; `standard` applies the tested Windows adapters. See the eval guide for remaining limitations.

## Repository boundaries

Commit research, prompts, example settings, version/checksum manifests, scripts, and sanitized evaluation results. Keep model weights, executables, sessions, credentials, cookies, and private learning notes outside Git. `knowledge/` is ignored by default; use `knowledge.example/` as its layout reference.

Local Git is initialized on `main`; GitHub CLI setup and a remote under `rolfhelder` are deferred. The selected packages have a reconstruction path; full model/task validation and a fresh-PC restoration test remain pending. See [the migration runbook](docs/WINDOWS-MIGRATION.md) for offline backup requirements.

Both candidate downloads are verified and their initial test batch finished. See [all four results and the GPT-OSS investigation](docs/CODING-FOUR-MODELS.md). The [coding comparison](evaluation/CODING-MODELS-2026-10-21.md) updates when each result is exported. GPT-OSS has a native 128k window and is not configured for 200k.

Inside `pia`, `/model` now offers local models and effort controls; `/effort high` changes the next request without an LLM turn. See [effort levels and model capabilities](docs/EFFORT-AND-MODEL-MENU.md). The portable pi-app download and PowerShell startup-directory setup are recorded in [Windows migration](docs/WINDOWS-MIGRATION.md).

**Desktop:** Start → **Pi App**, or `pia-app`, starts the configured local desktop setup. See [Pi App setup, effort switch and browser panel](docs/PI-APP.md).
