# Autocode

Autocode is an automation agent that reads GitHub PRD issues and implements them
end-to-end via the Claude Code CLI inside a Docker container. It:

1. Fetches a PRD issue and all of its sub-issues from GitHub.
2. Runs a **planning** pass that prints a deterministic execution order.
3. Creates a git worktree on a fresh feature branch.
4. For every sub-issue, in topological order, starts a fresh Claude Code
   subprocess with TDD instructions; commits the result; closes the issue.
5. Runs a **review** pass over the full diff against `main` and prints the
   report to stdout.

No code is pushed or PR'd automatically — the user reviews and pushes manually.

---

## How autocode expects your issues to look

Autocode relies on the same issue template that the rest of the project already
uses:

- The **PRD issue** is a regular issue describing the feature at high level
  (usually labelled `PRD`).
- Each **sub-issue** must contain these two sections in its body:

  ```markdown
  ## Parent PRD
  #5

  ## Blocked by
  #6, #7
  ```

  - `## Parent PRD` followed by the PRD number is how autocode discovers the
    sub-issue (no extra label required).
  - `## Blocked by` is parsed into the dependency graph. Use `None` or omit
    the section if there are no blockers.

- Each sub-issue body should include an `## Acceptance criteria` section with
  checkbox items. Claude treats each checkbox as a discrete test case during
  the TDD red phase.

- Labels `backend` and/or `frontend` on a sub-issue cause the matching
  language/framework prompt to be appended to the universal TDD prompt.
  Issues without either label still get the full TDD treatment, just with no
  language-specific rules.

---

## Prerequisites

You need all of the following installed on the host machine:

| Requirement                                                           | Why                                                             | How to check                                   |
|-----------------------------------------------------------------------|-----------------------------------------------------------------|------------------------------------------------|
| Docker (Desktop on Windows/macOS, Engine on Linux)                    | Runs the autocode container.                                    | `docker --version`                             |
| Docker Compose v2                                                     | Used to launch the container with the right mounts.             | `docker compose version`                       |
| A local clone of the target repo                                      | Mounted into the container as `/repo`.                          | `git -C <path> status`                         |
| An active Claude Code subscription, already logged in on this machine | The container reuses the host's OAuth tokens from `~/.claude/`. | `claude --help` should work in a host terminal |
| A GitHub Personal Access Token                                        | Used to read issues and close them via the GitHub API.          | See next section.                              |

> **Note on host paths**
> On Windows, the path `~/.claude` resolves through `%USERPROFILE%`. The
> `docker-compose.yml` falls back to `${USERPROFILE}` automatically.

---

## Creating a GitHub Personal Access Token

Autocode needs a token that can:

- Read issues and their labels on your repository.
- Close issues and post comments on them.

There are two types of tokens. **Fine-grained tokens are recommended.**

### Option A — Fine-grained personal access token (recommended)

1. Open GitHub in a browser and sign in.
2. Click your avatar (top right) → **Settings**.
3. In the left sidebar, scroll to **Developer settings** (at the bottom).
4. Click **Personal access tokens** → **Fine-grained tokens**.
5. Click **Generate new token**.
6. Fill in:
   - **Token name:** `autocode` (or any name you'll recognise).
   - **Expiration:** pick a value that fits your workflow. Tokens cannot be
     renewed — they have to be regenerated. 90 days is a sensible default.
   - **Resource owner:** the account or organisation that owns the target repo.
   - **Repository access:** *Only select repositories* → choose the target repo
     (e.g. `dennis-schaefer/interfero-ai`).
7. Under **Repository permissions**, set:
   - **Issues:** *Read and write* (required — autocode reads issues and closes them).
   - **Metadata:** *Read-only* (this is selected automatically and cannot be turned off).
   - Leave everything else as *No access*.
8. Click **Generate token**.
9. **Copy the token immediately.** GitHub will only show it once. Paste it
   into the `.env` file as described below.

### Option B — Classic personal access token

1. Avatar → **Settings** → **Developer settings** → **Personal access tokens**
   → **Tokens (classic)** → **Generate new token (classic)**.
2. Give it a note (e.g. `autocode`) and an expiration.
3. Tick the **`repo`** scope. (Yes, this grants more than autocode actually
   needs — that's why fine-grained tokens are preferable.)
4. Click **Generate token**, copy it, paste into `.env`.

### Storing the token

The token lives in `autocode/.env`, which is gitignored. Never commit it.
If you accidentally do, revoke it on GitHub and generate a new one — leaked
tokens cannot be un-leaked.

---

## Setup

From the repository root:

```bash
cd autocode
cp .env.example .env
```

Edit `.env` and fill in:

```dotenv
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_REPO=dennis-schaefer/interfero-ai
REPO_PATH=/local/path/to/interfero-ai
AUTOCODE_MODEL=opus
```

- `GITHUB_TOKEN` — the token from the previous section.
- `GITHUB_REPO` — must be in the form `owner/repo`.
- `REPO_PATH` — the absolute path on the **host** to the repo you want
  autocode to work on. This directory will be mounted into the container at
  `/repo`. On Windows, use forward slashes (`C:/Users/...`).
- `AUTOCODE_MODEL` — the Claude model used for every phase (plan,
  implementation, review). Short aliases (`opus`, `sonnet`, `haiku`) or full
  model IDs (`claude-opus-4-7`, `claude-sonnet-4-6`) both work. Override per
  run with `--model` on the CLI.

Then build the image once:

```bash
docker compose build
```

You only need to re-run `build` when something in the `autocode/` directory
itself changes (`Dockerfile`, `src/`, `prompts/`, etc.). Day-to-day runs use
the cached image.

---

## Usage

### Choosing the model

Every `agent run` resolves the Claude model in this order:

1. `--model <name>` on the CLI (per-run override).
2. `AUTOCODE_MODEL` from `.env` (default for every run).
3. Neither set → autocode exits with an error before spawning anything.

The same model is used for all three phases (plan, implementation, review).
Accepted values are anything Claude Code accepts: short aliases (`opus`,
`sonnet`, `haiku`) or full IDs (`claude-opus-4-7`, `claude-sonnet-4-6`, …).

### Dry-run — plan only

Use this first to sanity-check the execution plan without touching any files:

```bash
docker compose run --rm autocode agent run --issue 5 --dry-run
```

This prints the planning agent's output (sub-issue inventory, execution order,
instruction composition per issue, risk notes) and exits without creating a
worktree.

To try a different model just for this run, pass `--model`:

```bash
docker compose run --rm autocode agent run --issue 5 --dry-run --model sonnet
```

### Full run

```bash
docker compose run --rm autocode agent run --issue 5
```

What happens, in order:

1. Fetch PRD `#5` and all open issues whose body references it as
   `## Parent PRD\n#5`.
2. Run the planning agent.
3. Create a git worktree at `/workspace` (inside the container) on a new
   branch `feat/5-<slug-of-prd-title>` derived from `main`. The branch is
   immediately visible on the host because the `.git` object store is shared.
4. For each sub-issue in topological order:
   - Compose the system prompt (`basic.md` + optional `backend.md` /
     `frontend.md`).
   - Run `claude --print --system-prompt <composed> <issue title + body>`.
   - `git add -A && git commit -m "feat: <issue title> (closes #N)"`.
   - `gh issue close N --comment "Implemented in branch ..."` against your repo.
5. Run the review agent on the full `main...HEAD` diff. The report is printed
   to your terminal.
6. Remove the worktree (the branch and its commits remain).

### Inspecting the result on the host

When the container exits, you keep:

- A local branch `feat/5-...` with one commit per sub-issue.
- Closed GitHub issues, each with a traceability comment that points at the
  branch and commit SHA.

Recommended follow-up on the host:

```bash
git checkout feat/5-admin-bootstrap-authentication
git log --oneline
# review locally, then when happy:
git push -u origin feat/5-admin-bootstrap-authentication
gh pr create
```

Nothing is pushed automatically. That is intentional.

---

## What gets mounted into the container

| Host                                                       | Container            | Purpose                                                                                       |
|------------------------------------------------------------|----------------------|-----------------------------------------------------------------------------------------------|
| `${REPO_PATH}`                                             | `/repo`              | Target repository (shared `.git` store).                                                      |
| `${HOME}` (or `${USERPROFILE}` on Windows) `/.claude.json` | `/root/.claude.json` | Claude Code user-level config — silences the missing-config warning and binds the OAuth account. |
| `${HOME}` (or `${USERPROFILE}` on Windows) `/.claude`      | `/root/.claude`      | Claude Code OAuth tokens — reuses your host login.                                            |

The `/workspace` directory inside the container is a **git worktree** of
`/repo`, not a separate clone. Commits made there are instantly visible from
the host via `git log feat/...`.

---

## Troubleshooting

**`GITHUB_TOKEN is not set`**
The `.env` file is missing, empty, or not picked up. Make sure it sits in the
`autocode/` directory next to `docker-compose.yml`.

**`GITHUB_REPO must be in the form owner/repo`**
Use the slash-separated form, e.g. `dennis-schaefer/interfero-ai`. Not a full
URL.

**`claude: command not found` inside the container**
The image build step `npm install -g @anthropic-ai/claude-code` failed.
Rebuild with `docker compose build --no-cache autocode` and inspect the
output.

**Claude prompts for login when invoked**
The `~/.claude` mount is wrong or empty. On Windows, make sure
`C:/Users/<you>/.claude` actually contains your Claude Code credentials —
i.e. run `claude` once on the host first to log in.

**`Nothing to commit — Claude exited without changes.`**
Claude finished a sub-issue without producing a diff. Either the acceptance
criteria were ambiguous and Claude bailed (`BLOCKED` output), or the issue
needed no code. Re-read the planning output and the sub-issue body; tighten
the acceptance criteria and re-run.

**A leftover worktree on the host (`git worktree list` shows `/workspace`)**
This happens only if the container was killed mid-run. Clean up with
`git worktree remove --force <path>` and `git worktree prune` on the host.

**Wrong execution order**
Autocode trusts the `## Blocked by` references in the issue bodies. If the
order looks wrong, fix the references in GitHub, not in the code.

---

## Files in this directory

```
autocode/
├── Dockerfile              # Container image: Java 25 + Node 24 + git + gh + claude
├── docker-compose.yml      # Volume mounts and env wiring
├── .env.example            # Template for GITHUB_TOKEN, GITHUB_REPO, REPO_PATH
├── package.json            # commander, @octokit/rest, zod, tsx, typescript
├── tsconfig.json           # Strict TS, NodeNext, ES2022
├── src/
│   ├── index.ts            # CLI entrypoint
│   ├── github.ts           # Octokit wrapper + PRD/blocked-by parsing
│   ├── planner.ts          # Kahn topological sort
│   ├── runner.ts           # Plan / implement / review phases
│   └── worktree.ts         # git worktree lifecycle
└── prompts/
    ├── plan.md             # Planning agent system prompt
    ├── basic.md            # Universal TDD instructions
    ├── backend.md          # Java / Spring Boot rules (appended on `backend` label)
    ├── frontend.md         # TypeScript / React rules (appended on `frontend` label)
    └── review.md           # Review agent system prompt
```

For the full design rationale behind each of these choices, read `PLAN.md`
in this directory.
