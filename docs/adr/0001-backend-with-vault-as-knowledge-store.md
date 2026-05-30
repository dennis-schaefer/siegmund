# Always-on backend; Vault is the knowledge store, SQLite holds operational state

Siegmund runs as an always-on backend service (TypeScript/Node — see ADR-0003)
with thin clients, because asynchronous research, "done" push notifications, and
proactive reminders all require a process that runs independently of any device.

The Obsidian **Vault** (Markdown + YAML, Git-synced) is the single source of
truth for all _knowledge_ (Entries, research output). It is deliberately NOT
used for operational/machine state: a small embedded **SQLite** database holds
the job queue, dedup index, push tokens, scheduler state, etc., and **secrets**
(Google OAuth refresh tokens, API keys) live only in environment variables on
the server.

## Considered Options

- **Everything in the Git Vault** (the original wish): rejected — Git is a poor
  queue/DB, backend commits conflict with live Obsidian edits, and replicating
  secrets into Git history across all devices is a security leak.
- **A real DB as source of truth, Vault as a mirror**: rejected — contradicts
  the goal that the Vault is the original the user reads and edits directly.

## Consequences

- The SQLite DB holds only reconstructable/derived state, so durability and
  scaling requirements are minimal and backups are trivial.
- The backend must act as a Git client against the Vault (clone/commit/push)
  and handle merge conflicts in Markdown — see future ADR on Vault write
  mechanics.
