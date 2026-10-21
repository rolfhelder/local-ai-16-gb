# Windows reconstruction and PC migration

Target: reproduce this setup on another Windows PC before selling the current PC by the end of October 2026. All steps here are local/manual unless a script is explicitly named. Nothing has been published or uploaded.

## What belongs where

| Store | Contents | Transfer method |
|---|---|---|
| This Git repository | Research, prompts, scripts, nonsecret manifests, example config | Later push to a repository under `rolfhelder`, then clone |
| Runtime archive | Complete Pi distribution, llama.cpp binaries/DLLs, optional CLI installers | External drive or re-download exact assets with hashes |
| Model archive | GGUF, matching projector, source revision, checksums and licenses | External drive; Git stores only manifests |
| Private state | Knowledge notes, selected session files, extension configs and resolved caches | Separate encrypted private backup |
| Credentials | Provider/MCP tokens, browser state, SSH/Git credentials | Reauthenticate on destination; do not commit |

The current Pi and llama.cpp assets were found under sibling `local-ai/`. This research did not move them. The initializer detects that sibling on this computer; on a fresh clone it proposes ignored `runtime/` and `models/` paths. `machine.local.json` is regenerated per PC, so no tracked launch command depends on this user's absolute path.

## Rebuild on a clean Windows PC

1. Install Git for Windows and a maintained Node.js installation independent of Codex. Pi's current documented Node floor is 22.19; some candidates need >=22.22.2. Use a supported version meeting the highest chosen module requirement. Confirm `git`, `node`, `npm`, `npx` and Git Bash work. PowerShell 7 is recommended; scripts also avoid requiring its newer syntax. The current shell exposes a **Codex-managed Node path**, so do not assume that runtime survives migration.
2. Clone/copy this folder. Obtain Pi **1.3.0** for the initial reproduction, or deliberately choose a newer version and rerun acceptance tasks. For a portable installation extract the **whole** Windows archive into `runtime/pi/`; for an npm installation point the local config to its command shim. The source-only and Windows archive hashes are recorded in `manifests/pi-observed.json`. See [Pi releases](https://github.com/earendil-works/pi/releases) and [quickstart](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/quickstart.md).
3. Extract a compatible llama.cpp Windows backend and its required runtime DLLs into `runtime/llama.cpp/`. `manifests/llama-observed-assets.json` preserves the previously selected b11669 asset metadata; it is an observation, not a recommendation to use CUDA 12.4 on every GPU. Choose an appropriate newer backend if necessary and record it. [Releases](https://github.com/ggml-org/llama.cpp/releases).
4. Copy completed model directories into `models/`, retaining associated projectors. Compare SHA256 and file sizes against `manifests/models.download-plan.json`. That manifest records the existing plan, not download completion. Re-download from its exact Hugging Face revision if needed, subject to access/license requirements.
5. Run `Initialize-Lab.ps1`. Edit `machine.local.json` if paths differ. The initializer never overwrites existing configuration. It generates an isolated profile and absolute prompt paths for this clone. If you moved an existing clone with `.state`, update `prompts` paths in `.state/agent/settings.json` too; cloning tracked files and regenerating state avoids this issue.
6. Run `Test-Lab.ps1`. Inspect the detected GPU using `nvidia-smi` and actual system RAM. Keep context 16k, one model and one slot for the first trial on either machine.
7. Start llama.cpp, then Pi using the launchers. Load/select the model and pass the baseline acceptance tasks. After a deliberate successful upgrade, update observed versions/hashes.
8. Add optional tools one at a time, pin tested versions, and repeat only the relevant acceptance task. No third-party package is installed by these scripts. Do not copy all global Pi settings into the isolated profile blindly.

## Adding a reviewed extension to the isolated profile

The launcher changes `PI_CODING_AGENT_DIR` only for its child process. A plain `pi install` elsewhere would modify a different profile. For the lab profile in a PowerShell terminal:

```powershell
$labRoot = (Get-Location).Path  # run from repository root
$previousAgentDir = $env:PI_CODING_AGENT_DIR
try {
    $env:PI_CODING_AGENT_DIR = Join-Path $labRoot '.state/agent'
    $machine = Get-Content -Raw .\machine.local.json | ConvertFrom-Json
    # Substitute a reviewed version/commit, never leave the placeholder:
    & $machine.PiExecutable install 'npm:PACKAGE@TESTED_VERSION'
    & $machine.PiExecutable list
} finally {
    $env:PI_CODING_AGENT_DIR = $previousAgentDir
}
```

Before testing Playwright MCP, replace the version placeholder in `config/mcp.playwright.example.json`, set `enabled` to true, ensure Edge and npx are available, and save it as `.state/agent/mcp.json`. The example is intentionally disabled and is not loaded automatically. Run Pi's `mcp list` with the same profile environment to validate connectivity. Browser installation/resolution must be tested on the new PC. Compare direct/deferred exposure if the local model struggles to discover tools. [MCP docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/mcp.md).

## Before the sale

- Finish outstanding downloads and verify hashes. Copy the **full** executable distributions and DLLs, not just launcher executables.
- Back up `knowledge/` and any useful Pi sessions separately. Session paths can contain the old workspace location; test resuming a specific session file rather than assuming the history picker finds it automatically.
- Save resolved extension versions, dependency locks, browser versions and any offline caches needed for reconstruction. Pinning only top-level package versions is not a complete offline backup.
- Rebuild and run representative coding, research, transcript and GUI tasks on the other PC **before erasing this one**. Verify the backup can be opened and a model hash matches.
- Reauthenticate on the destination. After verifying migration, sign out/revoke old-device credentials and follow the Windows reset/drive-erasure process appropriate for selling the device. Do not erase or revoke anything as part of this research pass.

## GitHub later

The repository is initialized on `main`. No remote is configured. Later: install GitHub CLI, authenticate as `rolfhelder`, inspect `git status` and tracked files, choose visibility (private is a sensible initial choice), make the initial commit if still needed, then create/push `pi-local-lab`. Do not put private backups into GitHub just because the repository is private.

No license was selected for the user's original work; decide before public distribution. Upstream components retain their own licenses. No third-party source code has been vendored here.
