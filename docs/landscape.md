# Existing work and the deliberately narrow change

Checked 2026-11-05. This is not a claim that patch review, human approval or
baseline hashes are new inventions.

| Primary source | Existing capability | Our use and limits |
|---|---|---|
| [Agent-Native README](https://github.com/BuilderIO/agent-native), [official actions documentation](https://www.agent-native.com/docs/actions-overview/) | Shared typed actions across agents/UI, authorization, full app/harness/data infrastructure | **Actually imported** `@agent-native/core@0.223.0` (MIT). Uses real `defineAction`, wrapped input/authorization and tool metadata. Local transport/SQLite/UI are our own; the full hosted framework/runtime is not deployed. |
| [jsdiff README](https://github.com/kpdecker/jsdiff/tree/db0b12ace208da7fd741cf96d97f009347a9eaa8), [LICENSE](https://github.com/kpdecker/jsdiff/blob/db0b12ace208da7fd741cf96d97f009347a9eaa8/LICENSE) | Diff generation, structured hunks, zero-fuzz application | **Actually imported** `diff@9.0.0`, BSD-3-Clause. We use its algorithm instead of claiming a new patch engine. Paths and target text are separate, not read from imported unified patches. |
| [VS Code source README](https://github.com/microsoft/vscode/blob/48b0e17de39ccaa1e65f35a5d20f02c6ba166106/README.md), [MIT license](https://github.com/microsoft/vscode/blob/48b0e17de39ccaa1e65f35a5d20f02c6ba166106/LICENSE.txt), [official staging docs](https://code.visualstudio.com/docs/sourcecontrol/staging-commits) | Rich Git diff/review and partial staging in a mature editor | Design comparison only, no code/assets copied. We lack a full editor, Git index/branch/merge support and arbitrary worktrees. Our scope is a private text sandbox with separate agent/human capabilities and persisted recoverable receipts. The repository MIT license is not a claim about Microsoft product binaries/extensions/assets. |

The user value is one small inspectable loop: an agent drafts replacement text,
the server computes hunks from a known baseline, a person approves a subset,
drift revokes those decisions, and a one-file apply leaves an exact backup and
recoverable receipt. A later edit makes rollback refuse to destroy new work.
No separate model-specific write implementation bypasses the shared actions.

The app/fixture/UI and the custom transport/receipt model are independently
implemented. Direct npm dependencies are real reuse under their original
licenses, retained in `licenses/` and `THIRD_PARTY_NOTICES.md`. Release versions
and integrity values are in [source-versions.json](source-versions.json).
The Agent-Native release metadata has no `gitHead`; we do not invent an exact
commit mapping. The immutable npm release/integrity is the dependency pin.

14 meaningful tests cover partial approval and revocation, old revisions,
observed drift, last-check races, exact retries, backup/rollback, interrupted
operations on either side of rename, path/symlink/hardlink/text bounds and
actual framework/HTTP permission failures. Model tests use an injected transport;
no real model run, official Clips recording or competition submission is claimed.
