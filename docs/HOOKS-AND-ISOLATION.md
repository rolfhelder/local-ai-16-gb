# Native hooks, approvals and worktrees

Verified against installed Pi **1.3.0**, 2026-10-21. [Official extension documentation](https://pi.dev/docs/latest/extensions) and the installed `core/extensions/types.d.ts` are the contract; old package examples may differ.

## What Pi already provides

| Layer | Native events and useful behavior |
|---|---|
| Input and context | `input`, `before_agent_start`, `context`, `context_with_system`: rewrite input/context, add messages and customize the system prompt |
| Model transport | `before_provider_request`, `before_provider_headers`, `after_provider_response`, `provider_stream_event`: provider boundary instrumentation/customization |
| Tool permissions | `tool_call`: inspect/block or change arguments before execution; `tool_result`: transform the returned content/details/error |
| Execution telemetry | `tool_execution_start/update/end`, `turn_start/end`, `agent_start/end`, `agent_before_settle`, `agent_settled` |
| Session and recovery | `session_start`, before switch/fork/compact/tree, compact/compact_failed/tree/shutdown; several before events can cancel or supply custom behavior |
| Environment | `project_trust`, `resources_discover`, `model_select`, `user_bash`, session information changes |

This covers most Claude-style pre/post tool, prompt, session, stop and compaction use cases through TypeScript/JavaScript extension handlers. A hook can call an external CLI; it is not automatically a Claude `settings.json` shell-hook configuration. Event payloads, return semantics and failure behavior differ by event. Do not assume every event can cancel work or that all exceptions stop the agent. The tool hooks are the right permission boundary for model-issued tools; `user_bash` is a separate path.

Seven real Pi RPC checks passed: before-agent prompt customization, pre-tool blocking, post-tool transformation, custom event bus, turn lifecycle, settled state and shutdown. These use a scripted provider with real Pi/tool execution, spending no model tokens. Throwing-hook and other event-specific failure contracts are still listed for expanded coverage.

## Can we add an event easily?

Extensions have `pi.events.on/emit` for their own named events. We can publish `pia:research_saved` or `pia:lesson_ready` from code we control without forking Pi. That does **not** insert a new interception point inside an existing core operation. A genuinely new native phase needs an existing hook wrapper, SDK/client integration, or an upstream/core change that emits it. The [upstream discussion about Bash spawn hooks](https://github.com/earendil-works/pi/issues/3536) makes that distinction concrete.

Nested tools invoked using `ctx.executeTool()` pass through validation/tool hooks and emit execution events with parent IDs. Raw `child_process`, direct SDK calls, and extension-private operations do not automatically become guarded tools. Extensions are trusted executable code.

## Near-YOLO policy on Windows

The standard profile combines [pi-guard 1.6.0](https://github.com/jdiamond/pi-guard) for parsed Bash/file matching with our PowerShell AST adapter. Upstream's generic unknown-tool fallback prompts even with a top-level `"*": "allow"`; the adapter limits that policy to Bash/write/edit so unrelated tools remain automatic. Upstream alone does not classify PowerShell deletion. Both facts were checked against source and real tool trials.

Reads, builds, normal writes/edits, dependency installation, ordinary Git commits and branch switches run automatically. File deletion, disk formatting, Git metadata writes, history rewrites, branch/tag/repository deletion and force-push patterns request approval. TUI confirmations can approve or decline; unattended RPC/print destructive calls fail closed. Commands are parsed as data; the fixed parser runs without changing Windows execution policy. Quoted examples do not trigger deletion prompts.

37 policy checks and five real nested-Bash guard cases passed. This is an ergonomic accidental-destruction guard, **not a sandbox or complete security policy**. Opaque scripts, renamed executables, unsupported command spellings, extension-private operations, and destructive GUI actions can bypass command classification. A normal edit can also remove text. The requested “95%” is a preference, not a measured coverage percentage. Keep backups and inspect proposed destructive actions.

## Worktrees without another module

Native Git worktrees already isolate a checkout while sharing repository objects. They work sequentially; no subagent is needed. From a repository, for an explicitly chosen task name:

```powershell
git worktree add -b task/topic ..\project-topic HEAD
pia --cwd ..\project-topic
git worktree list
```

The new checkout starts from the chosen commit; uncommitted files are not copied. Per-project files, builds and dependencies belong to that checkout. The inference lock remains shared by every `pia` invocation from this installation, so worktrees cannot accidentally start parallel model sessions. Keep worktrees until their changes have been reviewed; removal is a destructive action and needs permission. No real project worktree was created merely for this research.

## Browser beside the session

`pia --browser` opens a named headed Edge session via Playwright CLI, and closes that owned browser session on normal exit. This is a **separate window**, not an embedded Pi terminal sidebar. Browser profiles/cookies stay under ignored local state.

[vastsa/PI-Desktop](https://github.com/vastsa/PI-Desktop) is the strongest researched Windows candidate for a truly integrated workspace. Its [plugin documentation](https://github.com/vastsa/PI-Desktop/blob/main/docs/plugin-development.md) describes a right work panel beside Review, Terminal, Browser and Files, with isolated HTML views. It is an early desktop project, not part of Pi's native TUI. It is not installed or validated here; its orchestration features are unnecessary for our single-session setup. Treat a desktop migration as a separate client trial against the same local endpoint and acceptance tests.
