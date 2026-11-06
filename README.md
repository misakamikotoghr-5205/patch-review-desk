# Patch Review Desk

A small shared text workspace where an agent proposes changes and a person
approves individual hunks. Applying a subset retains an exact baseline backup;
an observed baseline change revokes approvals. It does not execute a shell or
edit an arbitrary checkout.

## Run locally

Node **24+** (including built-in SQLite), no cloud account needed for the fixture:

```sh
npm ci --ignore-scripts --omit=optional
npm run init
npm run dev
# http://127.0.0.1:4185
```

Copy the `human` token from the private `.data/roles.json` file into the local
page. Tokens remain in page memory. `npm run init` creates a fictional workshop
notice without replacing an existing fixture or token file.

1. Open the desk, select `welcome.md`, and draft the two fixed fixture edits.
2. Send the proposal for review. Approve only one of its two hunks; try revoking
   it and approving again.
3. Apply approved hunks and inspect the changed baseline and persisted receipt.
4. Download the receipt, including exact before/after text and hashes. Roll back
   to restore the original. Later edits make rollback fail rather than overwrite
   new work.

The fixture helper is deterministic. No inference is performed by the UI/server.
The page is a local tool, not a public hosted demo or production multiuser editor.

On 2026-11-06, an isolated manual UI check used a fresh workspace, SQLite ledger
and role capabilities on port 4186, seeded only with `fixtures/welcome.md`. The
agent page created two hunks with approval controls disabled; the human page
approved and applied only the first. The baseline changed to `09:30` while the
original final sentence stayed unchanged. Confirmed rollback restored `09:00`
and the exact original SHA-256, with both receipts retained. Both native browser
confirmation dialogs were visibly accepted, not bypassed. See the
[sanitized UI evidence](docs/evidence/ui-fixture-20261106.json). This run was
fixture/model-off and was not screen-recorded.

A later isolated reviewer workflow was recorded on port 4187 and is available
as a [public Clips demo](https://clips.agent-native.com/share/r01FTO1ytVvm)
(about 2:05, no audio or camera). It shows review, one-hunk apply and rollback
of a fixed proposal created by an agent capability before recording; it does
not show LLM generation or the off-screen proposal creation. Official metadata
reports `ready`, and the share page and recommended frames were accessible
without cookies. A logged-in browser played naturally to the end without a
decode error; full anonymous-browser playback is not claimed. See the
[recording evidence](docs/evidence/clip-recording-20261106.json). Formal event
submission still awaits final rules/eligibility confirmation. The separate
local-model probes below retain their original limitations.

## Real Agent-Native use

`@agent-native/core@0.223.0` is an installed, locked dependency, not a lookalike.
[actions/index.js](actions/index.js) defines shared operations with the official
`defineAction()`. Its wrapped `run` enforces Zod input contracts and the framework
`authorize` gate for both local HTTP callers and the UI. Agent tool descriptions
come from the actual definitions. Agent callers receive only `inspect` and
`propose`; `review`, `apply`, and `rollback` are hidden from the agent catalog and
also reject the agent capability at execution time. Sending `patchActor` in the
JSON body cannot forge transport-derived identity.

This app supplies its **own small local HTTP transport and SQLite persistence**.
It does not run Agent-Native's Nitro/React hosting, SQL data sync, built-in agent
harness, cloud identity, or framework DB audit. Automatic framework DB audit is
explicitly disabled; application receipts are persisted locally. This narrow
integration is exercised by runtime contract tests against the installed package.

## Optional actual local agent

Install and choose a suitably licensed local Ollama model yourself. With the desk
server running:

```sh
PATCH_OLLAMA_MODEL=your-installed-model npm run agent -- "Make the notice more welcoming without changing its schedule"
```

This explicitly calls the fixed loopback Ollama `/api/chat` endpoint, validates a
text-only JSON answer, then submits a proposal using the **agent** token through
the same Agent-Native action definitions. It cannot approve or apply changes.
Model output cannot select a different path, invoke a tool, or add approval
fields. It fails when unconfigured or invalid; there is no fake-success fallback.
Only `welcome.md` and your editing goal are sent to this local model. On
2026-11-06, production `modelDraft()` was genuinely exercised twice against local
Ollama using the complete fictional fixture and the same short-announcement goal.
The original `qwen2.5:0.5b` request timed out at 45 seconds. A same-base-model
alias with explicit bounded settings returned in 19.261 seconds and passed the
text-only contract. It preserved `09:00`, but omitted the requested heading and
kept the original body instead of producing the requested two-line announcement.
**Passing the text contract did not establish that the editing goal was met.**
[The evidence](docs/evidence/local-model-20261106.json) retains both requests,
the raw accepted response and the original timeout; the reproducible
[Modelfile](docs/evidence/Modelfile) caps output at 256 tokens. These observations
do not establish a speed fix or general model quality. No role token, private
workspace, proposal, approval, file application or UI sequence was used in this
probe. Unit tests continue to inject a contract transport.
An external agent may instead use `/api/tools` and `/api/actions/propose` with
the separate agent token. Do not give it the human token or unrestricted OS tools.

## Boundaries and recovery

- Only existing **flat** text filenames inside `.data/workspace/` are supported:
  `.md`, `.txt`, `.json`, `.js`, `.css`, `.html`. No directory selector, file
  creation/deletion/rename, unified-diff path parsing, Git operations, binary
  files, symlinks or hardlinks. UTF-8 text is limited to 100 KB; diffs to 40 hunks
  with an edit/compute limit. CRLF and a UTF-8 BOM are retained.
- Approvals bind server-generated hunks to immutable baseline content and a
  proposal revision. Drift observed by inspect/review/apply makes the proposal
  permanently stale. Unobserved external edit-and-revert cannot be detected.
- Apply rechecks baseline bytes immediately before a same-directory atomic
  single-file rename. The durable `prepared` receipt contains before/after
  hashes and backup text. On restart the disk hash classifies it as `applied`,
  `aborted`, or `conflict`; recovery never blindly rewrites a file. Exact retries
  return the saved receipt. An `aborted` attempt needs review and a new key.
- One local server should own the workspace. This is not a filesystem sandbox
  against a hostile process running as your OS user. External editors can still
  race between the final hash check and rename; no OS compare-and-swap or
  multi-process locking claim is made. Stop outside writers while applying.
- Receipts contain file content. Keep `.data/` and downloaded backups private.
  Hashes check content, not authorship; the local database is not a signed audit.
  A hard interruption can leave a hidden `.stage-*` file; inspect/delete it only
  while the server is stopped. No stage file is exposed as a workspace document.

## Verification and delivery

```sh
npm test
npm run check
npm run build
```

14 behavior tests cover partial approval, stale revisions and baselines,
idempotency, injected final-check races, recovery before/after rename, safe
rollback, path/link/text boundaries, real framework authorization, local HTTP and
constrained model replies. `dist/` includes runnable source, fixtures, tests and
notices, excluding data/tokens/dependencies. It is a Node server distribution,
not a static site. No GitHub Actions workflow or remote CI claim is included.

[Competition assessment](docs/competition.md) records the Builder.io deadline and
the official receipt of the entry on November 6, 2026. [Landscape](docs/landscape.md) compares
Agent-Native, jsdiff and VS Code; patch review itself is established practice.
Application code and fictional fixture: MIT. Dependencies retain their own
licenses; see [third-party notices](THIRD_PARTY_NOTICES.md).
