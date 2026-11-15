# AI assistance disclosure

AKM Health was developed with AI assistance through OpenAI Codex and, during the Space Apps weekend, Anthropic's Claude (through Claude Code). The assistance included implementation, code review, tests, documentation and synthetic demo work documented in task/PR records. This AKM-31 README/architecture/source guide and its verification orchestration were prepared with that assistance and checked against repository files and executed commands.

This disclosure is not a complete inventory of every contributor's tools or model versions. Those versions and other contributors' use are not recorded here; the team must reconcile them before a submission requiring a complete declaration. Do not invent model versions, authors, training data or approval history.

The running investigation engine uses deterministic Python rules, not an LLM API. No OpenAI API key, paid LLM endpoint or external inference service is required by the current runtime. AI-assisted development is distinct from an AI inference dependency.

Mission profiles/readings are fictional synthetic demonstration data or manually entered fictional records. NASA historical values must come from the credited audited source, not generated guesses. AI-generated output is not a medical/scientific validation or proof of NASA endorsement.

PR authors and human reviewers remain responsible for correctness, source/license checks and final approval. Commits are authored by the human team member who made them; the assistant is not listed as a commit coauthor, and this document is where its use is disclosed. The requester subsequently authorized the [Apache-2.0 project license](../LICENSE). Contributor acknowledgments and event-specific disclosure remain team responsibilities.

## Declaration by team member

Each member completes their own row before submitting the Space Apps form, and lists the same tools in the form's AI-use field. Leave nothing out: the form asks for every AI tool used.

| Member | AI tools used | What they were used for |
| --- | --- | --- |
| Artur Vinicius Pereira Fernandes | Anthropic Claude (through Claude Code); OpenAI Codex | Implementation, code review, tests, deployment configuration, documentation and interface polish across the project, including the final weekend changes: "Why this finding" panel, downlink report, guided tour, link-loss simulation, body map illustration, input-safety fixes and the README. |
| Other members | To be completed by each member | To be completed by each member |

## Generated media

- The application ships no AI-generated photographs, audio or video. Its illustrations (the body map, animated backgrounds, hazard cards) are vector or canvas drawings written as code, with Claude's help where noted above.
- If the demo video or slides use AI-generated images or a synthetic voice, mark them with a visible watermark or on-screen label, as the Space Apps rules require.
