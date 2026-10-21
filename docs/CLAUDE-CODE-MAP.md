# Claude Code baseline translated to Pi

This is a migration design map, not an exhaustive current Claude Code product comparison. The left column describes workflows the user wants to retain; the right columns describe the researched Pi route and its limits.

For the requested historical source-based analysis of Claude Code 2.1.88, including tool execution, compaction, agents, gates and background consolidation, see [architecture research](ARCHITECTURE-RESEARCH.md). The preferred browser route is now Playwright CLI; MCP stays optional.

| Familiar workflow | Pi route | Practical limit / next check |
|---|---|---|
| Read/edit/write and run code | Native tools; optional native PowerShell | Tool use depends on the local model and chat template |
| Project instructions and reusable skills | AGENTS.md / CLAUDE.md, Pi skills | Read inherited instructions; don't import secrets or product-specific tools blindly |
| Reusable commands | Markdown prompt templates | Included research/teach/build prompts are workflows, not new executable tools |
| Session history, resume, branching | Pi session files, `/resume`, `/tree` | Session storage is private state; changed project paths need migration checks |
| Context management | `/compact` and automatic compaction | Small local contexts need smaller reserves; summaries can lose evidence |
| Plan before implementation | Prompt discipline initially; plan extension later | A prompt is not enforcement; Bash-only guards can miss PowerShell |
| Tool integrations | Built-in MCP | Start with a small visible tool set; deferred discovery/codemode add reasoning burden |
| Web search and page reading | One web extension | Search can contact remote providers even when inference is local |
| Browser automation / app testing | Playwright MCP | DOM/accessibility snapshots differ from desktop GUI control |
| Native Windows application use | Semantic computer-use extension | UI accessibility varies by app; pixel tasks may need a separate vision test |
| Specialized subagents | Extension or upstream example | Separate contexts do not make a small model smarter; concurrency costs memory/latency |
| Task lists and long objectives | Markdown task files, then todos/goal extensions | Avoid indefinite loops; require observable progress and stopping limits |
| IDE-like diagnostics/navigation | LSP extension + actual language server | Needs the language toolchain; diagnostics do not replace runtime tests |
| Review diffs and undo mistakes | Git branches/diffs/commits; optional checkpoint example | No auto-commit/auto-push enabled in this starter |
| Personal desktop interface | Optional pi-desktop | Terminal remains the reproducible baseline |
| Massive research followed by teaching | Saved evidence → synthesis → lesson → quiz | A staged process is essential with a small context window |

The largest gap is model capability, not the number of installed tools. Judge the replacement by completed personal tasks: correct edits, recovery after errors, accurate sources, and dependable UI actions. A local model that passes a tool schema test can still struggle with multi-step planning.

Primary references: [Pi usage](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/usage.md), [sessions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sessions.md), [prompt templates](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/prompt-templates.md), [Windows tools](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/windows.md), and the module sources in [RESEARCH.md](RESEARCH.md).
