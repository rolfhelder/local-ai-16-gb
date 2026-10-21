# Research-pass verification — 2026-10-21

**Historical first pass.** Later installation, real-model trials and automated comparisons are recorded in [EVALS.md](../docs/EVALS.md) and [the sanitized baseline](BASELINE-2026-10-21.json). The pending-model and untested-inference statements below describe the earlier check only.

## Passed

- Observed local Pi package metadata and executable version: `@earendil-works/pi-coding-agent` 1.3.0.
- Inspected installed Pi models, llama.cpp, MCP, Windows, settings, compaction, package, prompt and example documentation.
- Existing llama-server b11669 `--help` recognized `--models-dir`, `--models-max`, `--no-models-autoload`, `--jinja`, `--parallel`, and GPU-layer arguments. This is a CLI smoke check, not an inference test.
- Parsed all 9 tracked/example JSON files present at the check, including the observed asset/model manifests.
- Parsed all 4 PowerShell scripts with the PowerShell parser; no syntax errors.
- Ran initialization repeatedly. Existing profile preservation was checked by SHA256 before/after a repeat run.
- Both launch scripts produced expected dry-run executable/environment/argument objects: loopback router, 16,384 context, one slot, one loaded model maximum, isolated agent directory.
- All relative Markdown links resolved at validation time.
- Git ignore checks excluded machine config, isolated profile, models, private knowledge, environment file and executable runtime.
- Git initialized with branch `main`; no remote configured.

## Observed prerequisites and limits

- Pi executable, llama-server executable and model directory exist under the sibling `local-ai` tree.
- No completed non-projector `.gguf` file was found at the prerequisite check. The existing download plan has four model/projector entries. Downloads were not stopped or altered.
- Git and nvidia-smi were on PATH. Node and PowerShell 7 were exposed through Codex-managed paths. npm, npx, yt-dlp and FFmpeg were not on PATH in this shell; this does not prove they are absent everywhere on the PC.
- Source checksum metadata was preserved for the Pi archive. An attempted independent archive hash check could not run because that ZIP was no longer present at the observed path. The hash in `pi-observed.json` is therefore from the existing checksum file, not an independently verified current archive.
- No network downloads, package installs, desktop actions, browser tasks, provider authentication, model inference or third-party extension loading were performed for this repository.
- Research sources establish advertised capabilities; native Windows/local-model compatibility remains untested for candidates.

## Pending

Run acceptance A–K from `docs/VALIDATION.md` as prerequisites become available. Record exact tested extension versions and dependency resolution before calling the setup reproducible end to end. A clean Windows restoration test remains required before the current computer is sold.
