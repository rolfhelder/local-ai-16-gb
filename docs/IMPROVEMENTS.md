# Improvements: current implementation and demonstrations

These changes are independent and opt-in. Normal local-ai still selects Gemma at the configured 204800 window; no new public repository has been created. Implementation and acceptance evidence differ by item. A prototype is not a verified fresh-machine installer.

## 1. Read-only doctor

Run `local-ai doctor` for the readable terminal view; add `--verify-model` for an explicit full GGUF checksum. It checks local tool files/versions, NVIDIA identity/free VRAM, host RAM/disk and a matching running endpoint. With the server stopped, endpoint/backend remain unknown. Actual GPU offload is read from run-scoped startup logs, not inferred from GPU presence. Live evidence requires a matching endpoint, model/context, running PID and Windows port owner. Older evidence is labeled historical. Layer counts verify backend allocation, not Windows physical VRAM residency or kernel utilization; shared-memory spill/performance requires separate measurements. `local-ai doctor --check-gpu` explicitly loads a temporary slot of up to 32768 tokens, verifies layer counts and weight/KV allocations, then stops its owned server. Invalid/missing dependency and wrong endpoint fixtures were tested. The report uses framed cyan/green/gray sections, GB units and usage bars. Real paths are shown by default; `--public` hides external folders and uses relative project paths, `--json` retains machine-readable output, and `--no-color` / `--ascii` support basic terminals.

## 2. Core installation plus acceptance

Use `local-ai install --plan` to inspect actions or `local-ai install --check` to check the current installation. Before PATH registration, use `.\bin\local-ai.cmd install --plan` from the checkout. `local-ai install` opens the setup/first-run menu (install, inventory, acceptance, doctor). Model-based actions discover installed GGUFs and ask for a choice when several exist. Its installation choice (or direct `local-ai install --run`) downloads core assets and registers commands; it has not passed a clean Windows VM acceptance yet. [Installation and model choices](INSTALL.md) documents separate model selection.

Preview `local-ai test`, then run `local-ai test --run` for a bounded real test. The live dashboard shows measured hash progress, active-step elapsed time and a completed-check bar; `--json` provides structured output. It verifies the hash, owns/checks one endpoint, requests a real answer and runs Pi on a disposable repair. It uses an isolated profile and private effort state. Completed stages, settings, runtime versions, outcomes and timings are saved together in report.json under .state/acceptance/. Gemma passed the original live four-stage test; the sandbox-only attempt failed endpoint readiness before inference. Neither result is a long-context quality score.

## Quick demonstration commands

| Item | Command | Default behavior |
|---|---|---|
| 3 | `local-ai --context 32768` | Explicit context override; saved default otherwise |
| 5 | Automatic after `local-ai test --run` | One local report; path printed at completion |
| 7 (development) | `pnpm eval:coding-check` | Preview one repair, clean and with 100k background |

`local-ai help` lists everyday commands. Development evaluations stay separate from installation and normal startup.

## 3. Context settings

Normal startup uses ContextSize from machine.local.json, capped by a registered model's native limit. Acceptance always uses a conservative 32768-token slot without changing that saved setting. For a one-off override, use `local-ai --context 65536`. The named resource presets and their separate comparison command have been removed. Context capacity is not a coding-quality guarantee.

## 4. Separate progress observer — abandoned

Progress belongs in startup, doctor and tests. The standalone log observer and its command have been removed. Their old local evidence remains preserved.

## 5. One automatic acceptance report

Acceptance saves one private `report.json` with the settings, model fingerprint evidence, Node/Pi versions, runtime command, per-stage outcomes, timings and errors. The terminal prints its location. Missing VRAM measurements stay null. There is no receipt viewer, history menu or automatic public/private export pair. Existing old receipts and test evidence are preserved locally. Reports include local paths and should be reviewed before sharing.

## 6. Separate configuration reconstruction — abandoned

The installer creates missing machine configuration and preserves an existing one. The independent defaults-merging command and demo have been removed. Fresh-machine installation still needs a real acceptance trial; a merge helper does not prove portability.

## 7. Development coding check

This is a development tool, not an everyday harness command. `pnpm eval:coding-check` previews one model (Gemma), one CSV repair and one background variant: two trials, clean and with 100000 unrelated tokens, at 131072 context. Explicitly add `--run` to execute. Choose another tested model with `--models qwen`. Additional cases, models and background variants remain explicit research options, never automatic setup work.

The method, preserved public checks and hidden grading remain the same as the recorded model experiments. Each repair retains its six-minute deadline; a clean tracked tree is required and controller failures retain completed results. Controller completion is not a quality pass. No new model-quality experiment was run for this simplification. Existing comparisons and methodology remain in [the testing guide](TESTING.md).

## Validation boundaries

On October 23, 2026, the simplified setup passed a real 65536-token Gemma startup probe and all four acceptance stages at 32768 tokens. Acceptance saved only report.json, stopped its owned server and preserved the 204800 production context. All 118 unit/regression checks passed, including retired commands, model configuration, single-report metadata and timeout scoring.

The two-trial development coding check completed operationally but scored **1/2 full passes**: clean passed; the 100k-background repair passed all hidden checks but exceeded the six-minute normal-completion deadline. It remains a failure, not a successful long-context trial. The evaluator now shows per-trial scores and returns nonzero for this outcome. See [the recorded validation results](TESTING.md#simplified-setup-validation-october-23-2026).

Fresh-machine installation still needs a clean-machine trial, and macOS/Linux remain unvalidated. Private artifacts stay ignored. Use one model/session at a time.
