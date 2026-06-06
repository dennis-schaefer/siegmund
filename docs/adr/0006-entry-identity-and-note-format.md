# Entry identity and note format

Each Entry is one atomic Markdown note (ADR-0005). The PRD (issue #2)
deliberately left the exact id scheme, frontmatter field set, and note body to
be fixed when building the Entry/Area domain (Module 3). We fix them here
because they are hard to reverse once notes exist in the Vault and a future
reader would otherwise wonder why we did not just use an opaque id.

**Identity.** An Entry's `id` equals its filename stem:
`YYYY-MM-DD-HHMMSS-<content-slug>` (e.g. `2026-06-06-143207-milch-kaufen`),
derived from an injected capture timestamp (wall-clock from the ISO offset, not
UTC-normalized) plus a slug of the Entry text. Chosen over an opaque ULID
because the atomic notes are still occasionally seen in the file tree and Git
history, and a human-readable, time-sortable name aids debugging and manual
recovery — at the cost of needing the text to build the id and a small
collision risk within the same second (the Module-4 writer appends `-2`/`-3` on
a real filesystem collision; an optional segment index disambiguates multiple
Entries split from one capture).

**Frontmatter (MVP), fixed emit order.** `id, title, type, status, created,
source, area`. `area` is a slug (`inbox` for unrouted Entries); `status`
defaults to `open` and is always present (even for thoughts, which have no
lifecycle — kept uniform rather than special-cased); `created` is ISO 8601 with
offset. `type` and `status` are open vocabulary: unknown values are stored and
shown, never rejected (tolerant reader, per CONTEXT.md).

**Body.** Plain cleaned Entry text — no `# H1` (the title lives in frontmatter
and is shown by Hubs; duplicating it as an H1 invites drift).

**Round-trip is value-preserving, not byte-preserving.** Parsing a note keeps
unknown frontmatter keys in an `extras` bag and re-emits them after the known
fields, so a user's hand-added frontmatter (e.g. `priority: high`) survives a
Siegmund rewrite. YAML comments and original key order are *not* preserved —
acceptable for the MVP. The one place tolerance yields: genuinely unparseable
YAML raises `MalformedFrontmatterError` so the Module-4 writer quarantines the
file instead of overwriting it — never silently discarding content (ADR-0005).

## Considered Options

- **Opaque ULID id / filename**: rejected — guaranteed-unique and naturally
  time-sortable, but opaque in the file tree and Git history; readability won
  for a single-user, manually-recoverable Vault.
- **Byte/comment-preserving round-trip** (YAML CST): rejected for the MVP —
  meaningfully more complex for a case (frontmatter comments) that is rare in
  practice and that Obsidian itself often reorders anyway.
- **Slugs keep Unicode umlauts**: rejected — `ä/ö/ü` in filenames are
  fragile across the Linux server and other devices; we transliterate
  (`ä→ae, ö→oe, ü→ue, ß→ss`) instead.

## Consequences

- The id needs the Entry text, so id construction happens after segmentation,
  not at capture intake.
- Because the schema is an open, tolerant vocabulary, new `type`/`status`
  values need no migration — only a config entry to gain special automation.
