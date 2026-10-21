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

## Recommendation

Start with Pi's existing llama.cpp integration, the Qwen3.5 9B Q4 model already queued for download, and small sequential tasks. Add **one** search extension, transcript retrieval, browser automation, and Windows computer use in separate trials. Use saved Markdown research batches before attempting large agent teams.

The most interesting research package is [@lincoln504/pi-research](https://github.com/Lincoln504/pi-research); its documented 100k+ context requirement makes it an experiment after the small-context baseline works. [Playwright MCP](https://github.com/microsoft/playwright-mcp) offers browser accessibility snapshots without requiring a vision model. The Windows candidate for desktop applications is [@injaneity/pi-computer-use](https://github.com/injaneity/pi-computer-use).

These recommendations are source-reviewed candidates, **not installed or benchmarked extensions**. No cloud model or paid search service is required by the starter profile. Internet research still contacts websites/search engines.

## Starter commands

From this folder, use PowerShell:

```powershell
.\scripts\Initialize-Lab.ps1
.\scripts\Test-Lab.ps1
.\scripts\Start-Llama.ps1 -DryRun
.\scripts\Start-Pi.ps1 -DryRun
```

Initialization creates ignored `machine.local.json` and `.state/agent/settings.json`. It detects existing sibling `local-ai` assets, or uses ignored `runtime/` and `models/` directories on a new machine. Edit `machine.local.json` to match the new installation. No downloads or third-party installations run automatically.

When a complete model is available, run `Start-Llama.ps1` in one terminal and `Start-Pi.ps1` in another. In Pi use `/login llama.cpp`, `/llama` to load one model, and `/model` to select it. The launcher sets the router URL for that process as well. See the playbook before increasing context.

The launcher uses an isolated Pi profile under `.state/agent`, preserving your existing personal Pi configuration. The scripts restore process environment variables when Pi exits. The profile loads the reusable `/research-topic`, `/teach-topic`, and `/build-personal-tool` prompts from this repository. These prompts guide behavior; they do not install tools or enforce a sandbox.

## Repository boundaries

Commit research, prompts, example settings, version/checksum manifests, scripts, and sanitized evaluation results. Keep model weights, executables, sessions, credentials, cookies, and private learning notes outside Git. `knowledge/` is ignored by default; use `knowledge.example/` as its layout reference.

Local Git is initialized on `main`; GitHub CLI setup and a remote under `rolfhelder` are deferred. This is a research/starter repository, not a completed one-command installation of the full ecosystem. See [the migration runbook](docs/WINDOWS-MIGRATION.md) for the remaining reconstruction steps and offline backup requirements.
