# Pi extensions, hooks and guardrails

Configuration observed 2026-10-21/22: Pi 1.3.0, pinned dependencies in package.json and pnpm-lock.yaml. Prefer CLI/API integrations when equivalent. Native Pi extensions run in the harness; they do not require MCP. These selections target one loaded model and one active inference session.

## Profiles and configuration

After the core README checklist, run:

```powershell
local-ai                          # standard: guard, LSP, context, effort
local-ai --profile native         # minimal conformance baseline
local-ai --profile web            # optional web package
local-ai --profile research       # optional bounded research package
local-ai --profile desktop        # optional computer-use package
local-ai --browser                # separate headed browser window
```

Profiles are generated under ignored .state/profiles/ by scripts/local-runtime.mjs. Edit the profile builder for reproducible changes; generated settings can be overwritten next launch. It writes models.json pointing at 127.0.0.1:48763/v1, with the loaded model's alias and context/output caps. Native baseline intentionally lacks standard-profile enhancements.

The pinned optional packages are installed by pnpm but separate browser/helper assets are not. For those integrations, review and run scripts/Initialize-Lab.ps1 followed by scripts/Setup-Integrations.ps1; the latter needs the legacy isolated profile initialized first. It explicitly installs browser/helper assets rather than allowing every dependency's lifecycle scripts. This is not required for the core CLI. Keep experimental tools out of the default profile until their task tests pass.

## Context usage and effort

Our context-status extension adds context usage to the terminal footer. Tool-budget hooks cap output rather than letting a small model fill its window with logs. The native /effort command changes session state without an LLM turn:

```text
/effort low
/effort medium
/effort high
/effort off
```

Local budgets: off 0, low 512, medium 2048, high 4096 thinking tokens; default total output cap 8192. Gemma/Qwen/OmniCoder use local token budgets, not a claim of distinct natively trained effort levels. GPT-OSS maps low/medium/high to native effort and does not support off. /effort without an argument opens the picker; changes are session-only unless explicitly saved with --save. Model weights still require restarting the launcher with --model. The [eval guide](TESTING.md) separates the working production extension from models' failed attempts to recreate it.

## Destructive-command approvals

[pi-guard](https://github.com/jdiamond/pi-guard) 1.6.0 supplies Bash/file policy. Our Bash adapter restricts the upstream fallback to relevant tools; our PowerShell AST adapter covers Windows commands upstream did not classify. Ordinary reads, edits, builds, dependency installs and local Git commits run automatically. Deletion, history rewriting, force pushes and similar destructive commands request approval. Unattended destructive calls fail closed.

Rules live in config/guard.rules.json and extensions/windows-destructive-policy.mjs. This is an accidental-destruction guard, not an OS sandbox: opaque scripts, extension-private child processes and destructive GUI actions are not comprehensively intercepted. The desired mostly-automatic experience is not a measured 95% safety guarantee. Real nested-tool and policy tests are included in the eval suite.

## LSP for code navigation

[pi-lsp-extension](https://github.com/samfoy/pi-lsp-extension) 1.4.0 adds diagnostics, definition, hover, references and rename tools. The standard Windows profile uses extensions/lsp-windows.mjs to adapt pinned server paths and URI handling; TypeScript 5.9.3 and typescript-language-server 6.0.2 are locked dependencies. Runtime preparation generates local project settings. Semantic navigation and diagnostic freshness were tested; this does not imply every language server is configured. Do not copy machine-specific server paths to another PC.

## Web search and research

[@arcanemachine/pi-web-search](https://github.com/arcanemachine/pi-web-search) 3.0.0 provides bounded fetch/find/cache/search tools. Our web profile disables LLM summarization, caps page text and limits results. Scripted/live extraction checks passed 13/14; live DuckDuckGo search failed with parse_failed. A dependency TypeBox warning remains. Keep it optional until search is reliable.

[@lincoln504/pi-research](https://github.com/Lincoln504/pi-research) 1.7.13 provides a broader retrieval workflow. Our bounded trial used depth 0, one query, two scrapes, BM25 and one worker; one real research trial completed in about 220.5 seconds. That is not an all-model research-quality comparison. Avoid concurrency or an extra embedding model on this RAM budget. A declared Arrow/LanceDB compatibility warning has not been exhaustively resolved.

## Browser and computer use

[Playwright CLI](https://github.com/microsoft/playwright-cli) 0.1.22 is the chosen browser automation interface. A disposable local form and named-session isolation were tested. The CLI launcher --browser opens a separate Edge window and owns its cleanup; it is not an embedded terminal sidebar. Browser state/cookies stay ignored. A desktop sidebar is available through optional [Pi App](PI-APP.md).

[@injaneity/pi-computer-use](https://github.com/injaneity/pi-computer-use) 0.5.1 was installed with its Windows helper; registration/protocol smoke checks passed. Real native desktop tasks and image grounding are not task-validated. Installed tools do not make a text-only model reliably interpret screenshots.

## Native hooks and isolated checkouts

Pi 1.3.0 already exposes input/context, before_agent_start, tool_call/tool_result, tool execution, turn/agent lifecycle, session/compaction and provider request/response events. before_provider_request supplies our effort budget hook; tool_call supplies approvals. Seven real-Pi scripted-provider hook checks passed. Read the [upstream extension contract](https://pi.dev/docs/latest/extensions) for event-specific return and cancellation semantics. These are JavaScript/TypeScript handlers, not an interchangeable Claude shell-hook settings file.

Extensions can emit custom events using pi.events.on/emit. That cannot create an interception point inside a core operation that emits no event. Raw extension child processes do not automatically become guarded tools; extensions are trusted code.

Native Git worktrees isolate sequential sessions without another module:

```powershell
git worktree add -b task/topic ../project-topic HEAD
local-ai --cwd ../project-topic
git worktree list
```

Uncommitted edits are not copied. Dependencies belong to each checkout; the installation's inference lock remains shared. Worktree removal is destructive and should be reviewed.

## Researched alternatives, not installed recommendations

[Context7](https://github.com/upstash/context7) was a library-documentation candidate; it was not task-validated in this stack. [pi-localllm-provider](https://github.com/freeyoung/pi-localllm-provider) offers local endpoint probes and fallbacks, but Windows/Pi 1.3 compatibility has not been tested here. [llama-cpp-windows-manager](https://github.com/alekk89/llama-cpp-windows-manager) is a broader runtime/profile manager; using it would be a separate migration trial, not another default service.

The full repository survey stays in local ignored research notes. Personal teaching/transcription workflows are deliberately outside this public configuration guide.
