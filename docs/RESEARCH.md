# Pi ecosystem research — 2026-10-21

## Decision

Build a small, reproducible native-Windows stack around upstream Pi. Preserve the ability to replace individual modules. Start with 16 GB VRAM, one loaded model, one inference slot, and a 16k context trial. Treat all third-party compatibility claims below as documentation evidence until tested on this installation.

The local installation identifies itself as `@earendil-works/pi-coding-agent` **1.3.0**. The old `badlogic/pi-mono` URL now redirects to [earendil-works/pi](https://github.com/earendil-works/pi). Old `@mariozechner` imports and extension manifests need checking against current APIs. Search results from forks can lag substantially.

Pi's extension layers serve different purposes: TypeScript extensions add behavior/tools; skills provide on-demand instructions and helper files; prompt templates create reusable commands; packages distribute these resources. MCP connects external tool servers. Prefer the smallest layer that supplies a missing capability. Sources: [extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [skills](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md), [packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).

## Shortlist

Priority means fit for this user's workflow, not measured quality. “Trial” means a good next experiment; it does not mean approved or installed. Links are primary project sources. Windows support is marked separately from compatibility with the exact Pi release.

| Module / source | Value | Dependencies, limits, Windows evidence | Decision |
|---|---|---|---|
| [Built-in llama.cpp provider](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/llama-cpp.md) | Router discovery, load/unload, local model selection | Existing Pi 1.3.0 has it; router mode required | Use before adding a model-manager extension |
| [Built-in MCP](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/mcp.md) | Reuse tools across harnesses | stdio / streamable HTTP; direct, deferred, or codemode exposure | Use; no adapter package needed |
| [arcanemachine/pi-web-search](https://github.com/arcanemachine/pi-web-search) | Bounded search, URL text and text finding | DuckDuckGo default; optional SearXNG / Brave; Node >=22.19; no Windows trial here | First lean search candidate |
| [nicobailon/pi-web-access](https://github.com/nicobailon/pi-web-access) | Broad search and extraction integration | Many remote backends; more configuration and tool surface | Alternative to lean search, not a second default |
| [demigodmode/pi-web-agent](https://github.com/demigodmode/pi-web-agent) | Search/fetch with explicit browser escalation | Backend and browser dependencies vary | Compare if the first search candidate underperforms |
| [Lincoln504/pi-research](https://github.com/Lincoln504/pi-research) | Iterative research, cited reports, persistent knowledge store | Node >=22.22.2, large browser download, documented 100k+ model context; upstream supports Pi 1.x | High-interest later experiment |
| [badlogic/pi-skills: youtube-transcript](https://github.com/badlogic/pi-skills/tree/main/youtube-transcript) | Small transcript-reading workflow | Node helper + npm dependencies; launch via `node` on Windows | Trial for captions before cloud video analysis |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Video discovery, metadata, subtitle retrieval | Native Windows executable; YouTube access can break or be rate-limited | Portable CLI fallback / discovery tool |
| [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) | Local speech transcription when captions are absent | Own model/runtime; prepare audio with FFmpeg | Optional fallback; schedule separately from coding model |
| [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp) | Browser interaction and personal app validation | Accessibility snapshots work with text models; Node + browser required | First browser automation trial |
| [Microsoft Playwright CLI](https://github.com/microsoft/playwright-cli) | Browser actions through shell commands and skills | Official CLI alternative; smaller declared tool surface, browser/runtime still required | Compare with MCP for the 16k-context baseline |
| [badlogic/pi-skills: browser-tools](https://github.com/badlogic/pi-skills/tree/main/browser-tools) | CLI-oriented browser control using CDP | Chrome + Node; inspect startup scripts for Windows assumptions | Smaller alternative; compare to MCP |
| [injaneity/pi-computer-use](https://github.com/injaneity/pi-computer-use) | Observe and control desktop apps using semantic UI targets | Explicit Windows support; interactive desktop required | First Windows desktop trial |
| [husain-zaidi/pi-computer-use](https://github.com/husain-zaidi/pi-computer-use) | Playwright + PyAutoGUI via Python execution | Windows tested upstream; Python venv, Chromium; screenshot grounding must be evaluated with local vision | Alternative if semantic desktop coverage is insufficient |
| [nicobailon/pi-subagents](https://github.com/nicobailon/pi-subagents) | Child agents, saved workflows, async artifacts | Current manifest uses Earendil peers; native Windows spawning not tested here | Preferred rich orchestration candidate after baseline |
| [Upstream subagent example](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/subagent) | Inspectable separate-process delegation | Bundled example agent files include cloud model IDs; adapt before running | Minimal reference; do not copy unchanged |
| [badlogic/pi-subagent](https://github.com/badlogic/pi-subagent) | Persistent observable child sessions | Requires tmux | Defer on native Windows; possible WSL option |
| [samfoy/pi-lsp-extension](https://github.com/samfoy/pi-lsp-extension) | Diagnostics, definitions, references, symbols, rename previews | Language servers and structural-analysis dependencies; Windows trial needed | First narrow code-intelligence candidate |
| [apmantza/pi-lens](https://github.com/apmantza/pi-lens) | LSP plus lint/format/structural feedback | Larger overlapping feature set; dependency scripts need review | Alternative to LSP candidate |
| [floydous/pi-agent-kernel](https://github.com/floydous/pi-agent-kernel) | Retrieval, repository maps, LSP, edit tooling | Replaces core tools; lean BM25 mode avoids embedding RAM | Later experiment for larger repositories |
| [Official Context7 Pi extension](https://github.com/upstash/context7/blob/master/docs/clients/pi.mdx) | Current library documentation | Remote service; anonymous limits, optional API key | Useful coding addition, not local/offline documentation |
| [Upstream plan-mode example](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/plan-mode) | Plan toggle and progress widget | Bash allowlist must be checked against PowerShell/custom tools | Small inspectable starting point |
| [pi-vault/pi-plan](https://github.com/pi-vault/pi-plan) | Planning with explicit mutation-tool controls | Shell/custom-tool coverage must be tested on Windows | Alternative for a Claude-like plan workflow |
| [jdiamond/pi-guard](https://github.com/jdiamond/pi-guard) | Tool permission rules | General tool rules; Bash parsing is not PowerShell parsing | Evaluate only with coverage tests |
| [@narumitw/pi-goal](https://github.com/narumiruna/pi-extensions/tree/main/packages/pi-goal) | Continue a bounded objective across turns | Repeated inference; configure progress/response limits | Later for long research and implementation jobs |
| [babariviere/pi-extensions](https://github.com/babariviere/pi-extensions) | Native todos, apply-patch, guardrail options | Select individual features; avoid duplicate replacement tools | Reference catalogue / selective trial |
| [FaqFirebase/pi-desktop](https://github.com/FaqFirebase/pi-desktop) | Desktop UI, files, terminal and diffs | Advertises Windows; extra application to maintain | Optional ergonomics after terminal setup |

## What to actually try first

1. **Baseline:** existing Pi + llama.cpp, one local model, no external extensions. Verify multi-turn tool use and editing before browser or search work.
2. **Research:** one bounded web-search extension and a transcript CLI. Store evidence on disk. Initially choose no paid search API; this is a reversible planning assumption pending user preference.
3. **Personal software:** Playwright MCP with an isolated browser profile, then a language-server extension if semantic navigation is a bottleneck.
4. **Desktop:** `@injaneity/pi-computer-use`, tested on a harmless local app. Prefer semantic UI text; add vision only when it is actually required.
5. **Delegation:** one child at a time. Confirm children inherit the isolated profile and use the same local endpoint, with no cloud model IDs.
6. **Large research:** evaluate pi-research only after proving memory and usable context. Its README describes local DuckDuckGo browsing, a local knowledge store, and an optional BM25 retrieval mode. Its “unlimited” description is not a guarantee that websites will permit unlimited requests.

No default “mega pack”: duplicate tools increase selection ambiguity and make regressions harder to attribute. That is a design choice for a resource-constrained model, not a claim that bundles are inherently bad.

Microsoft's [Playwright CLI documentation](https://github.com/microsoft/playwright-cli) recommends CLI/skills for many coding-agent workflows to reduce schema/context overhead. Keep the MCP example for interoperability, but compare both on the same personal-app test rather than assuming MCP is the best browser route for a small model.

## YouTube: transcription and video understanding differ

Pi Web Access documents Gemini-based YouTube understanding, with cloud fallbacks. That is useful if explicitly wanted, but it does not satisfy a local transcript-only goal by itself. Its video feature should not silently become the default just because its web search is convenient. [Video processing documentation](https://github.com/nicobailon/pi-web-access#youtube-videos).

Prefer caption retrieval first. A transcript is evidence of speech, not of diagrams, code, or actions visible on screen. When those matter, extract a few frames and use a locally supported vision model, or mark the visual details unverified. Local audio transcription is a separate fallback for missing captions.

## Compatibility and installation policy

Pi supports `pi install npm:package@version` and `pi install git:github.com/owner/repo@ref`. Pin a tested release or commit after review; record it in `manifests/extensions.candidates.json` when promoting a candidate. Git `main` and npm `latest` are discovery channels, not a reproducible lock. A pinned top-level package alone may still allow drifting transitive dependencies; keep the resolved lock/cache or a reviewed vendored snapshot where necessary. [Package docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).

Do not install the entire Pi monorepo as if it were an extension bundle. Load an example explicitly or package the selected example with its required files. Check imports, peer dependencies, supported Pi range, lifecycle scripts, child process launching, local-model selection, and Windows path handling. No candidate source was exhaustively audited in this research pass.

## Trust boundaries relevant to this setup

Pi project trust is a startup resource decision; it does not confine subsequent tools to that folder. Extensions and MCP servers run with their process permissions. Plan/permission extensions can help prevent mistakes but do not create OS isolation. For unattended experiments use a dedicated environment with only the required files and credentials exposed. Desktop automation needs an interactive Windows session and a deliberately limited set of applications. [Upstream security model](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/security.md).

## Evidence notes

- Primary sources were searched and read on 2026-10-21. Search results also surfaced stale forks; recommendations above link the maintained project or original author source.
- Local package metadata/docs were inspected; existing llama-server `--help` confirmed router, Jinja, maximum-model and parallel-slot flags.
- Model-download manifests were copied as metadata only. They describe planned downloads, not proof that model files are complete or hash-verified.
- Hardware fit, local tool-use quality, desktop grounding, search reliability and end-to-end extension compatibility remain open measurements.
