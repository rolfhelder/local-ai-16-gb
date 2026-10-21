# Reuse survey: local harnesses and evaluation infrastructure

Research checked 2026-10-21. Selection favors native Windows, 16 GB VRAM, one active model request, CLI/API integrations and reproducible dependencies. Repository claims are not independent benchmark evidence.

| Project | Reusable parts | Why it is not our full replacement |
|---|---|---|
| [pi-coding-agent-eval](https://github.com/alexshpunt/pi-coding-agent-eval) | Custom suites, balanced profile ordering, telemetry and comparisons; points to the existing test engine | Package's older declared Pi peer range needs review before adopting wholesale |
| [pi-coding-agent-test](https://www.npmjs.com/package/pi-coding-agent-test) | Real Pi processes with scripted providers, real tools, RPC traces and optional real-provider runs | Installed pinned **0.1.4**; provides a runner, not our task contracts or graders |
| [HarnessBench](https://github.com/ya5h-P/harnessbench) | Local endpoints, single concurrency, resumable tasks and a larger task bank | Shell/Python workflow needs Windows adaptation; avoid treating example leaderboard numbers as our model's performance |
| [pi-local-harness](https://github.com/humanrouter/pi-local-harness) | Reliability hooks, bounded recovery and golden tests | Experimental, Bun-oriented; do not stack recovery machinery before measuring native Pi |
| [highsite/pi-harness](https://github.com/highsite/pi-harness) | Persistent research/verification workflows, smaller active context | macOS/MLX/large-model assumptions do not fit this Windows GPU |
| [BeaudanBrown/pi-harness](https://github.com/BeaudanBrown/pi-harness) | Exact-revision launcher identity and provider attestation | Nix packaging is a portability mismatch; borrow the provenance idea |
| [Pi SDK Providers on GitLab](https://gitlab.com/ai-agents-dev/pi-sdk-providers/-/blob/main/README.md) | SDK loop/provider/thinking/tool-allowlist experiments | A sandbox with cloud-oriented examples, not a turnkey local Windows kit |
| [locca](https://github.com/perminder-klair/locca) | Launcher/model-serving UX and benchmarking ideas | Published platform assumptions target Linux/macOS; not our native Windows installation |
| [Pi upstream evals](https://github.com/earendil-works/pi/tree/main/packages/evals) | Existing behavioral evaluation approach | Needs task/model/version selection; no need to reproduce a generic runner from scratch |

The useful heavy lifting already exists at the **test runner** level. Our added code defines disposable fixtures, comparative profiles, semantic assertions, Windows compatibility and the portable launcher. Keep that layer small. No subagent package or plan-mode module has been installed.

## LSP candidates and selection

[samfoy/pi-lsp-extension](https://github.com/samfoy/pi-lsp-extension) **1.4.0** is installed with TypeScript **5.9.3** and typescript-language-server **6.0.2**. It provides semantic LSP tools and syntax/AST fallbacks. Syntax-only success must never pass a type-checking test. The raw module initially returned `any`, incomplete references and a false-clean diagnostic on our cold Windows fixture.

Opening the intermediary module and allowing server warm-up fixed semantic navigation. A confirmed Windows URI mismatch still hid published diagnostics: Node produced `file:///C:/...`, while the server published `file:///c%3A/...`. The standard profile generates an adjacent copy of the pinned extension with **two diagnostic-cache key normalizations**. It preserves upstream source, license and dependencies. Exact expected source fragments must match or setup fails for review. `lsp` remains raw; `lsp-windows` selects the compatibility copy. This should become an upstream fix rather than an indefinitely maintained fork.

The generated project configuration invokes the portable Node executable directly, avoiding Windows `.cmd` spawning problems. It disables automatic type acquisition and package auto-import scanning to reduce unrelated work. It preserves a user-owned `.pi-lsp.json` and regenerates only lab-owned configuration after moving the repo.

[arcdev-llc/pi-lsp](https://github.com/arcdev-llc/pi-lsp) is an alternative to evaluate later; its described scoped package returned npm 404 during this pass. It has not been installed or scored. Our tests are independent of the module name: type errors, aliased definitions, inferred types, cross-file references and unapplied rename previews.
