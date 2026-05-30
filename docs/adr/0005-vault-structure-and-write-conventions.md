# Vault structure and write conventions

The Vault is organized into **Areas** (e.g. `sw-projekt-x`, `haushalt`). Each
Area is a folder `/areas/<area>/` containing an atomic note per Entry under
`entries/` plus a templated `_hub.md`. A top-level `_areas.md` indexes all
Areas. Unrouted Entries are parked in `/inbox/` so nothing is lost.

**Atomic notes, dynamic Hubs.** One Entry = one atomic Markdown note with
`type`/`status` frontmatter. Readability comes not from browsing the folder but
from **Hubs** — mostly-static Dataview/Bases queries (+ embeds) that aggregate
an Area's Entries into a live, filtered, zero-cost reading surface. This keeps
per-Entry status in clean frontmatter (trivial to scan for proactive
resurfacing) and keeps Git conflicts rare (new files don't collide).

**Conventions live in a Skill, not in LLM improvisation.** A Skill encodes the
exact folder layout, frontmatter schema, and Hub template so structure never
drifts; the agent's real judgement work is only Area **routing** and proposing
new Areas.

**Single `main` branch, backend is the serialized sole writer.** Writes are
queued so two agent runs never clobber a file. The backend does
`pull --rebase → push` with retry. On the rare real conflict (a manual edit
racing the agent) the agent resolves it **preserving all content — never
silently discarding**, keeping both sides if unsure, and notifies the user.

**Taxonomy governance gate.** Routing into an existing Area is auto-allowed, but
**creating a new Area is user-gated** (push notification asking for
confirmation). This extends the ADR-0003 permission model beyond
"external vs internal": some internal _structural_ actions are gated because the
user wants authority over the taxonomy.
