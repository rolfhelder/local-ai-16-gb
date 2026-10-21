# Installed CLI-first stack — 2026-10-21

**Operational update:** `pia` is now the primary launcher with isolated profiles, a destructive-action guard, Windows-adapted LSP and automatic local model startup. See [current evals](EVALS.md) for real Qwen/context/Research evidence and [hooks/isolation](HOOKS-AND-ISOLATION.md) for approvals and browser behavior. Older router commands below remain optional alternatives.

## Selected versions

| Component | Installed version / route | Verification |
|---|---|---|
| Node | 24.22.1, portable official Windows ZIP | SHA256 matched official checksum; executable version checked |
| pnpm | 12.14.0, portable repo-local installation | Version checked; bootstrap dependencies locked |
| Pi | 1.3.0, Node package | Extension load + command/tool inventory passed |
| Playwright CLI | 0.1.22 | Version/help + isolated Edge form test passed |
| Pi Research | 1.7.13, native Pi extension and CLI | Browser installed; extension registration and CLI help passed |
| Pi Computer Use | 0.5.1, native Pi extension | Bundled Windows helper installed; protocol diagnostic and tool registration passed |

See `manifests/toolchain.observed.json`, `pnpm-lock.yaml`, and `config/pnpm-bootstrap/package-lock.json`. Pi's original standalone executable remains in sibling `local-ai`; the lab launcher now selects the matching Node CLI. During isolation tests the executable silently exited when Research was loaded, while computer use alone worked. Switching to Node fixed the extension-load check. The precise underlying cause was not established; this is an observed runtime incompatibility, not a proven upstream defect.

## Use from PowerShell

From the repository root:

```powershell
. .\scripts\Activate-Tools.ps1
pnpm --version
playwright-cli --version
playwright-cli -s=personal-app open http://127.0.0.1:3000 --browser msedge
playwright-cli -s=personal-app snapshot
playwright-cli -s=personal-app close
```

Activation affects the current PowerShell session. It does not modify persistent user/system PATH. The Pi launcher supplies the same tool paths to its own process, so its shell tools can find the CLIs without relying on Codex. On another PC rerun bootstrap and integration setup; do not copy old absolute profile paths blindly.

```powershell
.\scripts\Start-Llama.ps1  # one terminal, after a complete model exists
.\scripts\Start-Pi.ps1     # another terminal
```

Use `/llama`, `/model`, `/research-config`, and `/computer-use` in Pi. The official Playwright CLI skill was generated in ignored `.state/.agents/skills/playwright-cli` and added to the isolated profile. No MCP server was installed. Research and desktop tools are native Pi extensions; CLI/API-first does not require replacing useful native extensions with external servers.

Research's standalone CLI is also available as `pi-research`. Its `research` command supports `--depth 0` for a quick run and an explicit `--model provider/id`. Before actual use, select and verify a local model and mirror the launcher's state/cache/retrieval/concurrency environment. Do not assume a standalone CLI inherits the provider chosen inside an unrelated Pi session. Prefer the in-Pi extension initially so it can use that session's selected local model.

## Resource and storage choices

- Local inference stays at 16k context, one model/slot initially.
- Research: one researcher, one browser worker, one task per worker, one concurrent scrape; BM25 retrieval avoids loading an embedding model.
- Research state: `.state/research`; Research browser: `runtime/research-browser-cache`.
- Playwright helper/browser cache: `runtime/playwright-cache`; actual form test used installed Microsoft Edge.
- Windows helper: `runtime/computer/windows-bridge.exe`.
- Desktop extension browser access is disabled by the launcher; use Playwright CLI for web pages.
- The package dependency tree includes optional embedding runtimes even though BM25 is selected; downloading a library does not mean its model is loaded.

The pinned Research package declares a peer mismatch between LanceDB's Apache Arrow range and the Arrow version it uses. Installation and extension loading succeeded, but knowledge-store read/write compatibility has not yet been task-tested. Keep that warning visible in evaluation records rather than changing the dependency graph without a reproducer.

## Reconstruction and limits

Run `Initialize-Lab.ps1`, `Bootstrap-Toolchain.ps1`, then `Setup-Integrations.ps1`. The last script restores from the frozen pnpm lock with automatic dependency lifecycle scripts disabled, invokes the reviewed Windows-helper and Research-browser setup scripts explicitly, and generates the official browser skill. `-SkipResearchBrowser` skips its large download for a known existing cache.

The package-manager installation may need its normal per-user operation lock and internet access. A repository-local package store does not remove every per-user package-manager cache/lock. Browser runtime assets are separate from the pnpm dependency lock; preserve the runtime backup and observed version manifest for offline reproduction.

No inference run, full research report, or application-control task is claimed as validated yet. The Research README's 100k+ context requirement remains a practical open issue on this 16 GB baseline. Start with bounded/quick experiments only after the local model passes basic tool use.

## Four-model follow-up

Qwen, Gemma, OmniCoder and GPT-OSS have completed their initial coding runs. See [all four results and GPT-OSS setup repairs](CODING-FOUR-MODELS.md), including the invalid initial GPT-OSS loaded trials, portable search dependencies and exact request-token budgeting. Original artifacts are retained; rerun outcomes and separate recall controls are linked there.
