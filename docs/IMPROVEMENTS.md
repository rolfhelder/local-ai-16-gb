# Improvements: current implementation and demonstrations

These changes are independent and opt-in. Normal local-ai still selects Gemma at the configured 204800 window; no new public repository has been created. Implementation and acceptance evidence differ by item. A prototype is not a verified fresh-machine installer.

## 1. Read-only doctor

Run `local-ai doctor` for the readable terminal view; add `--verify-model` for an explicit full GGUF checksum. It checks local tool files/versions, NVIDIA identity/free VRAM, host RAM/disk and a matching running endpoint. With the server stopped, endpoint/backend remain unknown. Actual offloaded layers are not inferred from GPU presence; backend/port-owner diagnostics are not complete yet. Invalid/missing dependency and wrong endpoint fixtures were tested. Real paths are shown by default; `--public` hides external folders and uses relative project paths, `--json` retains machine-readable output, and `--no-color` / `--ascii` support basic terminals.

## 2. Core installation plus acceptance

Use `./scripts/Install-Core.ps1 -Plan` to inspect actions or `-Check` to check the current installation. The installation command itself downloads core assets and registers commands; it has not passed a clean Windows VM acceptance yet. [Installation and model choices](INSTALL.md) documents separate model selection.

Preview `node scripts/acceptance.mjs --model gemma`, then add `--run` for a bounded real test. It verifies the hash, owns/checks one endpoint, requests a real answer and runs Pi on a disposable repair. It uses an isolated profile and private effort state. Completed stages, failures, timings and receipts are saved under .state/acceptance/. Gemma passed the original live four-stage test; the sandbox-only attempt failed endpoint readiness before inference. Neither result is a long-context quality score.

## 3. Resource presets

Compare `local-ai --preset smoke --dry-run`, `--preset coding` and `--preset long-context`. They select 32768, 65536 and 204800 respectively, capped by the model's native limit. They are separate from extension --profile. Explicit --context overrides the preset. Presets without explicit overrides do not change any saved default. Unit/dry-run checks passed; long-context quality is still governed by the existing eval results.

## 4. Progress observer

Run `node scripts/progress.mjs --log PATH_TO_SERVER_LOG` to replay a log; add `--follow` to watch it. It reads bounded chunks and distinguishes ready, prefill, generating, generation-complete and allocation-error when the pinned log format provides evidence. Prefill ETA needs at least two samples and is approximate. Thirty seconds without newly parsed prefill progress emits an uncertainty warning; it does not kill the model. Parser fixtures and a completed real log were checked. It is a separate observer, not a new embedded Pi App panel.

## 5. Run receipts

Acceptance writes receipt.private.json with exact local arguments and receipt.public.json with path/credential redaction. Inspect these beside report.json. Earlier completed acceptance data also has a clearly marked retrospective receipt. Missing unique occupancy/peak VRAM measurements remain null; they are not estimated from post-run memory. Unit cases cover timeout/integrity/allocation/protocol distinctions and malicious credential/path fixtures. Review an export before publication; a redactor is not a comprehensive secret scanner.

## 6. Safe configuration preview and reconstruction

`node scripts/config-plan.mjs` previews missing default keys and preserves all existing values, including false and custom keys. It writes nothing by default. For a disposable demonstration, use --file .state/demo-config/machine.json; add --apply only when you want the planned additions written there. Applying twice is idempotent; changing an existing file makes a backup and uses a setup lock. Tests covered paths with spaces, preview preservation and repeat apply. This helper does not make the entire bootstrap/fresh-machine upgrade and rollback path validated; that acceptance remains pending.

## 7. Matched evaluation controller

`node evals/matched-evals.mjs` prints the proposed four-model, three-background-variant, two-condition matrix: 72 repair trials at a common 131072 context. A smaller preview is `--models=gemma --seeds=101`. No inference occurs without --run. The controller requires a clean tracked tree and retains completed results when a child controller fails. Child repair trials retain their existing deadlines. Controller completion is not a quality pass. Do not force-kill an active batch; verify owned process/lock cleanup before another launch.

The controller and failure-stop behavior were fixture-tested; the new 72-trial matrix has not been run. Seeds vary unrelated padding, not deterministic model decoding. A realistic repository task and broader statistical analysis remain to be added. The existing model ranking is unchanged.

## Validation boundaries

The combined unit suite passed 91 checks during this implementation, including the earlier 74 checks. Native Windows acceptance is functional evidence; the core install still needs a clean-machine trial, and macOS/Linux remain unvalidated. Private reports stay ignored. Use one model/session at a time and promote each improvement separately after its remaining gate passes.
