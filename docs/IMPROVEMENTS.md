# Improvements: current implementation and demonstrations

These changes are independent and opt-in. Normal local-ai still selects Gemma at the configured 204800 window; no new public repository has been created. Implementation and acceptance evidence differ by item. A prototype is not a verified fresh-machine installer.

## 1. Read-only doctor

Run `local-ai doctor` for the readable terminal view; add `--verify-model` for an explicit full GGUF checksum. It checks local tool files/versions, NVIDIA identity/free VRAM, host RAM/disk and a matching running endpoint. With the server stopped, endpoint/backend remain unknown. Actual GPU offload is read from run-scoped startup logs, not inferred from GPU presence. Live evidence requires a matching endpoint, model/context, running PID and Windows port owner. Older evidence is labeled historical. Layer counts verify backend allocation, not Windows physical VRAM residency or kernel utilization; shared-memory spill/performance requires separate measurements. `local-ai doctor --check-gpu` explicitly loads a temporary slot of up to 32768 tokens, verifies layer counts and weight/KV allocations, then stops its owned server. Invalid/missing dependency and wrong endpoint fixtures were tested. The report uses framed cyan/green/gray sections, GB units and usage bars. Real paths are shown by default; `--public` hides external folders and uses relative project paths, `--json` retains machine-readable output, and `--no-color` / `--ascii` support basic terminals.

## 2. Core installation plus acceptance

Use `local-ai install --plan` to inspect actions or `local-ai install --check` to check the current installation. Before PATH registration, use `.\bin\local-ai.cmd install --plan` from the checkout. `local-ai install` opens the setup/first-run menu (install, inventory, acceptance, doctor). Model-based actions discover installed GGUFs and ask for a choice when several exist. Its installation choice (or direct `local-ai install --run`) downloads core assets and registers commands; it has not passed a clean Windows VM acceptance yet. [Installation and model choices](INSTALL.md) documents separate model selection.

Preview `local-ai test`, then run `local-ai test --run` for a bounded real test. The live dashboard shows measured hash progress, active-step elapsed time and a completed-check bar; `--json` provides structured output. It verifies the hash, owns/checks one endpoint, requests a real answer and runs Pi on a disposable repair. It uses an isolated profile and private effort state. Completed stages, failures, timings and receipts are saved under .state/acceptance/. Gemma passed the original live four-stage test; the sandbox-only attempt failed endpoint readiness before inference. Neither result is a long-context quality score.

## Quick demonstration commands

| Item | Command | Default behavior |
|---|---|---|
| 3 | `local-ai presets` | Compare model resource settings |
| 4 | `local-ai progress` | Inspect latest server log |
| 5 | `local-ai receipts` | Inspect latest saved result |
| 6 | `local-ai config --demo` | Preview an isolated configuration |
| 7 | `local-ai eval` | Preview the evaluation matrix |

Every command supports `--help`, `--json`, `--no-color` and `--ascii`. `local-ai help` lists the main commands.

## 3. Resource presets

Run `local-ai presets` for a readable comparison table. Add `--model gpt-oss` to see model-specific caps, or `--json` for structured output. Start a preset with `local-ai --preset coding`. They select 32768, 65536 and 204800 respectively, capped by the model's native limit. They are separate from extension --profile. Explicit --context overrides the preset. Presets without explicit overrides do not change any saved default. Unit/dry-run checks passed; long-context quality is still governed by the existing eval results.

## 4. Progress observer

Run `local-ai progress` to inspect the latest known server log automatically; use `local-ai progress --follow` for a live bar, elapsed time and parsed progress, or `--log PATH` for a specific log. Ctrl+C returns to the terminal. Historical logs are labeled, unknown values remain unmeasured, and `--json` retains structured event output. It reads bounded chunks and distinguishes ready, prefill, generating, generation-complete and allocation-error when the pinned log format provides evidence. Prefill ETA needs at least two samples and is approximate. Thirty seconds without newly parsed prefill progress emits an uncertainty warning; it does not kill the model. Parser fixtures and a completed real log were checked. It is a separate observer, not a new embedded Pi App panel.

## 5. Run receipts

Run `local-ai receipts` for the latest result, settings, generation speed and measured memory in a human-readable report. `local-ai receipts --list` shows recent runs; `--file PATH` selects another receipt. Acceptance writes receipt.private.json with exact local arguments and receipt.public.json with path/credential redaction. `local-ai receipts --json --public` prints the redacted structured receipt. Earlier completed acceptance data also has a clearly marked retrospective receipt. Missing unique occupancy/peak VRAM measurements remain null; they are not estimated from post-run memory. Unit cases cover timeout/integrity/allocation/protocol distinctions and malicious credential/path fixtures. Review an export before publication; a redactor is not a comprehensive secret scanner.

## 6. Safe configuration preview and reconstruction

`local-ai config` previews missing default keys and preserves all existing values, including false and custom keys. It writes nothing by default. For a disposable demonstration, run `local-ai config --demo`; use `local-ai config --demo --apply` to write only the ignored demo configuration. Run it twice to see the no-change result. `local-ai config --apply` targets the real configuration; `--file PATH` selects a specific checkout-local file. Applying twice is idempotent; changing an existing file makes a backup and uses a setup lock. Tests covered paths with spaces, preview preservation and repeat apply. This helper does not make the entire bootstrap/fresh-machine upgrade and rollback path validated; that acceptance remains pending.

## 7. Matched evaluation controller

`local-ai eval` displays the proposed four-model, three-background-variant, two-condition matrix: 72 repair trials at a common 131072 context. A smaller preview is `local-ai eval --models gemma --seeds 101`. `local-ai eval --run` explicitly starts inference; each variant shows an animated activity indicator and observed completed-trial counts, with elapsed time. `--json` provides structured output. No inference occurs without --run. The controller requires a clean tracked tree and retains completed results when a child controller fails. Child repair trials retain their existing deadlines. Controller completion is not a quality pass. Do not force-kill an active batch; verify owned process/lock cleanup before another launch.

The controller, failure-stop behavior and human/JSON previews were fixture-tested; the new 72-trial matrix has not been run. Seeds vary unrelated padding, not deterministic model decoding. A realistic repository task and broader statistical analysis remain to be added. The existing model ranking is unchanged.

## Validation boundaries

The earlier implementation passed its unit suite; the command/UI pass adds launcher-level preview, JSON, failure-display and help checks without starting a new model evaluation. Native Windows acceptance is functional evidence; the core install still needs a clean-machine trial, and macOS/Linux remain unvalidated. Private reports stay ignored. Use one model/session at a time and promote each improvement separately after its remaining gate passes.
