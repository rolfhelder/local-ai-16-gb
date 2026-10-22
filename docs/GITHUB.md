# GitHub setup and migration

Intended repository: `rolfhelder/local-ai-16-gb`, private. The local project folder can keep its existing `pi-local-lab` name; GitHub repository names do not control local launcher paths.

GitHub CLI 2.103.0 was installed on Windows on 2026-10-22 using the official `GitHub.cli` WinGet package. On another PC:

```powershell
winget install --id GitHub.cli --exact --source winget
# Open a fresh PowerShell after installing.
gh auth login --hostname github.com --git-protocol https --web
gh api user --jq .login
gh auth setup-git --hostname github.com
gh repo clone rolfhelder/local-ai-16-gb
```

Complete browser authorization as `rolfhelder`. Never put authentication tokens, CLI credential storage or one-time login codes into this repository. Reauthenticate separately on the replacement PC. The current CLI can be invoked at its installed path if an already-open terminal has not refreshed PATH.

Before publishing, inspect tracked files and history. This setup excludes machine configuration, downloaded runtimes/weights, session transcripts, raw eval artifacts and private preferences. A tracked-history scan found no matching common GitHub/OpenAI token or private-key patterns; that check is bounded and does not imply that every possible secret format can be detected. The inactive user-created `prompts/effort.md` remains a separate untracked local file.

Once the private remote exists, normal updates use `git push origin main`. Follow [Windows migration](WINDOWS-MIGRATION.md) to recreate dependencies, model files and launchers; a Git clone by itself does not include those ignored assets. Gemma is the current default for both `pia` and `pia-app`.
