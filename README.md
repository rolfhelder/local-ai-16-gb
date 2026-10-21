# Pi Local Lab

A portable Windows research notebook and starter configuration for Rolf's move from subscription coding agents to Pi + local models.

Research date: **2026-10-21**. Current baseline: **16 GB VRAM**, one inference slot, native Windows. The other PC's reported 24 GB VRAM / 32 GB RAM is a later tuning target. Actual model performance and extension compatibility still require local trials.

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

## Recommendation

Start with Pi's existing llama.cpp integration, the Qwen3.5 9B Q4 model already queued for download, and small sequential tasks. Add **one** search extension, transcript retrieval, browser automation, and Windows computer use in separate trials. Use saved Markdown research batches before attempting large agent teams.

The most interesting research package is [@lincoln504/pi-research](https://github.com/Lincoln504/pi-research); its documented 100k+ context requirement makes it an experiment after the small-context baseline works. [Playwright MCP](https://github.com/microsoft/playwright-mcp) offers browser accessibility snapshots without requiring a vision model. The Windows candidate for desktop applications is [@injaneity/pi-computer-use](https://github.com/injaneity/pi-computer-use).

**Setup update:** Playwright CLI 0.1.22, Pi Research 1.7.13 and Pi Computer Use 0.5.1 are installed with locked dependencies. Both extensions load under Node-based Pi 1.3.0. Playwright passed a local form test; the Windows helper passed a protocol diagnostic. Research inference and desktop task performance remain untested. No cloud model or paid search service is configured by these scripts. Internet research still contacts websites/search engines.

## Starter commands

From this folder, use PowerShell:

```powershell
.\scripts\Initialize-Lab.ps1
.\scripts\Bootstrap-Toolchain.ps1
.\scripts\Setup-Integrations.ps1
. .\scripts\Activate-Tools.ps1
.\scripts\Test-Lab.ps1
.\scripts\Start-Llama.ps1 -DryRun
.\scripts\Start-Pi.ps1 -DryRun
```

Initialization creates ignored `machine.local.json` and `.state/agent/settings.json`. It detects existing sibling `local-ai` assets, or uses ignored `runtime/` and `models/` directories on a new machine. Bootstrap downloads checksum-verified Node and locked pnpm. Integration setup restores locked packages and browser/helper assets, installs the official Playwright skill into the isolated profile, and selects Node-based Pi. The Research browser download is about 1.3 GB. Edit `machine.local.json` for the model/server paths on the new machine.

When a complete model is available, run `Start-Llama.ps1` in one terminal and `Start-Pi.ps1` in another. In Pi use `/login llama.cpp`, `/llama` to load one model, and `/model` to select it. The launcher sets the router URL for that process as well. See the playbook before increasing context.

The launcher uses an isolated Pi profile under `.state/agent`, preserving your existing personal Pi configuration. The scripts restore process environment variables when Pi exits. The profile loads reusable research/teach/build prompts, official Playwright skill instructions, and the two native Pi extensions. Browser work uses CLI; computer use's browser access is disabled in the launcher. Research uses BM25 retrieval and one researcher/worker at a time. Its documented large-context requirement still needs evaluation on the 16 GB baseline.

## Repository boundaries

Commit research, prompts, example settings, version/checksum manifests, scripts, and sanitized evaluation results. Keep model weights, executables, sessions, credentials, cookies, and private learning notes outside Git. `knowledge/` is ignored by default; use `knowledge.example/` as its layout reference.

Local Git is initialized on `main`; GitHub CLI setup and a remote under `rolfhelder` are deferred. The selected packages have a reconstruction path; full model/task validation and a fresh-PC restoration test remain pending. See [the migration runbook](docs/WINDOWS-MIGRATION.md) for offline backup requirements.
