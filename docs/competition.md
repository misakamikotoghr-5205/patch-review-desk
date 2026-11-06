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

Still needed: entrant qualification/terms review, a recorded working
people-and-agent demonstration, a public Clips recording, accessible test
instructions and formal submission. No account was opened, event terms accepted,
recording uploaded, registration email sent or form submitted here.

The official rules require the functional Agent-Native app and public Clips
demo, not a specific LLM provider. The deterministic fixture is still model-off;
if a model segment is included, review the actual result and retain both the
timeout and goal-following limitation rather than presenting the contract pass
as successful editing. No public Clips recording has been produced.
