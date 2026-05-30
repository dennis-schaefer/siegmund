# Siegmund

Siegmund is a private, single-user AI assistant that captures the user's
thoughts, ideas, and tasks throughout the day, processes and categorizes them,
and stores them in one place reachable from any device. It can also run
research and produce summaries on request.

## Language

**Siegmund**:
The assistant itself — the always-on backend service plus its thin clients.
Not "the app", "the bot", or "the server" alone; Siegmund is the whole system.

**Vault**:
The user's Obsidian vault, synced across devices via Git. The single source of
truth for all _knowledge_ (Entries and research output) as Markdown + YAML
frontmatter. Operational/machine state and secrets explicitly do NOT live here.
_Avoid_: database, store, repo (when referring to knowledge).

**Entry**:
The single canonical knowledge unit captured by Siegmund and stored as one
atomic Markdown note in the Vault. Belongs to exactly one Area. Distinguished
only by its `type` and `status` frontmatter, not by separate structures. German
equivalent the user speaks: "Eintrag" / "Notiz".
_Avoid_: Note, record (for the domain concept).

**Area** (Themenbereich):
A top-level subject grouping that owns Entries — e.g. "SW Projekt X",
"Projekt Y", "Haushalt". Backed by a folder plus a Hub. Siegmund routes each
captured Entry into the matching Area; creating a NEW Area is user-gated (a
notification asks for confirmation) so the taxonomy never fragments silently.
_Avoid_: category, topic, project (when referring to this grouping).

**Hub**:
A mostly-dynamic overview note (Dataview / Bases queries + embeds) that
aggregates an Area's atomic Entries into a single readable surface. It is a
_reading_ surface, never where knowledge is authored. There is one Hub per Area
plus a top-level index Hub listing all Areas.
_Avoid_: index, dashboard, MOC (pick "Hub").

**Inbox**:
The holding Area for Entries that Siegmund could not confidently route to an
existing Area, parked there pending the user's Area decision so nothing is ever
lost.

**Type** (of an Entry):
An open vocabulary describing what kind of Entry this is. Known values today:
`thought` (Gedanke), `idea` (Idee), `task` (Aufgabe). Unknown types are stored
and shown but receive no special automation (tolerant reader). New types need a
config entry, never a schema migration.

**Status** (of an Entry):
An open vocabulary describing where an Entry is in its lifecycle, e.g. `open`,
`done`, `dropped`. Drives whether Siegmund resurfaces it. Unknown statuses are
tolerated like unknown Types.

**Thought** (Gedanke):
An Entry of type `thought`. Usually a free note with no lifecycle.

**Idea** (Idee):
An Entry of type `idea`. Has a realization lifecycle (open → done/dropped).
Open ideas are what Siegmund may proactively resurface; "done" ideas must not
be surfaced again.

**Task** (Aufgabe):
An Entry of type `task`. Classic to-do semantics (open/done, optional due date).
