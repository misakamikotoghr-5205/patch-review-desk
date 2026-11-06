# Builder.io Agent-Native Hackathon

Checked 2026-11-05 against the [official event](https://www.builder.io/hackathon)
and [full official rules](https://www.builder.io/hackathon/rules).

- Online worldwide, individual or team. Every person must be at least 18 or local
  majority age if higher. China is not explicitly excluded; applicable law,
  sanctions, identity/tax/payment eligibility and conflicts still require the
  entrant's own verification. No personal eligibility or payout guarantee.
- Building opened October 27, 2026. Registration and all webinars/live attendance
  are optional. Submit by **November 9, 2026 at 23:59 America/Los_Angeles (PST)**,
  equal to **November 10 at 07:59 UTC / 15:59 Beijing**.
- A functional app must genuinely use Agent-Native. Original work or meaningful
  new development during the window is allowed; disclose pre-existing work,
  templates, libraries and assets. Third-party rights and licenses apply.
- A public **Clips** recording must show the real working app and be viewable
  without login/access requests. A public repo/live deployment is encouraged,
  not required. Project description, creator/team details, contact info and
  the public Clips link must be submitted through the official form; recording
  alone does not submit an entry. No video duration limit was found in these
  rules. Entrants retain ownership; the organizer receives a limited event
  judging/showcase/promotional license to the submitted materials.

This project was created during the window and actually imports the official
framework action layer. It supplies a local working fixture and optional local
model proposal adapter. Runtime tests verify the installed framework's schemas
and authorization. This is not proof that a judge has accepted this narrow
integration. On 2026-11-06, production `modelDraft()` genuinely called local
Ollama: an original request timed out at 45 seconds, then a same-base-model
bounded alias returned in 19.261 seconds and passed the text-only contract. It
preserved the schedule but failed the requested two-line format and heading.
See [both requests and outcomes](evidence/local-model-20261106.json) and the
[alias settings](evidence/Modelfile). This is limited output evidence, not a
model-quality claim, successful goal-completion claim or framework action/UI
approval demonstration.

Separately, an isolated manual UI verification on 2026-11-06 exercised the
working fixture end to end: agent-capability proposal with two hunks and
disabled approval controls, human approval of only one hunk, confirmed partial
apply, and confirmed rollback. The time changed from 09:00 to 09:30 while the
unapproved final-sentence edit stayed out; rollback restored the original
content hash and both receipts remained. Native confirmation dialogs were
accepted through the visible host UI. This was model-off, used only the shipped
fictional fixture and fresh local storage, and was not recorded. See
[sanitized manual UI evidence](evidence/ui-fixture-20261106.json); it is separate
from the model-adapter probes and does not establish general model quality.

The earlier unrecorded check is now followed by a separate
[published Clips recording](https://clips.agent-native.com/share/r01FTO1ytVvm),
completed on 2026-11-06. The recording shows the reviewer UI loading a two-hunk
fixed proposal prepared with an independent agent capability before capture,
approval of only the time change, partial apply with the final sentence left
unchanged, and rollback. Its title marks the fixture/model-off scope; no LLM
generation or off-screen proposal creation is presented as recorded.

Official public metadata reports `ready`, 124,936 ms, 1280×720, no audio and no
camera. A cookie-free share-page request and all four recommended frame
requests returned 200. Separately, the logged-in browser played naturally to
the end (`ended=true`, no decode error). This does not establish full playback
in an anonymous browser. [Sanitized recording evidence](evidence/clip-recording-20261106.json)
keeps those checks distinct.

On 2026-11-06, after the entrant confirmed the completed entry, eligibility,
rights, official rules and personal-data processing, the entry was submitted
through the [official form](https://www.builder.io/hackathon/submit). The official
page displayed **“Thank you for submitting.”** and **“Your project submission
has been received.”** The optional marketing checkbox stayed unchecked. The
receipt screenshot is retained privately; no submission number was displayed.
[Sanitized submission evidence](evidence/submission-20261106.json) records the
observed result. This confirms receipt of the project entry, not judging
acceptance or an award.

The official rules require the functional Agent-Native app and public Clips
demo, not a specific LLM provider. The deterministic fixture is still model-off;
if a model segment is included, review the actual result and retain both the
timeout and goal-following limitation rather than presenting the contract pass
as successful editing. The published clip demonstrates the fixed fixture only.
