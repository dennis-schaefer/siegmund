# Deploying the Siegmund backend

This is a generic guide for running the Siegmund backend container. Updates are
performed manually (see [Updating to a new version](#updating-to-a-new-version)).
The reachability layer (Tailscale / Cloudflare Tunnel / public HTTPS) is a
deployment choice, not a repository concern, and is out of scope here.

The backend image is published to the GitHub Container Registry:

```
ghcr.io/<owner>/siegmund-backend
```

Replace `<owner>` with the GitHub owner/org that hosts the repository (for this
repo: `dennis-schaefer`). Tags are produced by CI:

- `vX.Y.Z` — a released version (recommended for production; pin to an exact tag)
- `latest` — the most recent release
- `edge` — the current `main` branch
- `sha-<short>` — a specific commit

## Pull and run

Pull the image:

```sh
docker pull ghcr.io/dennis-schaefer/siegmund-backend:latest
```

Run it directly with `docker run` (see [Configuration](#configuration) for the
required environment variables and volumes):

```sh
docker run -d \
  --name siegmund-backend \
  --restart unless-stopped \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e OPENROUTER_API_KEY="$OPENROUTER_API_KEY" \
  -v siegmund-sqlite:/data \
  -v siegmund-vault:/vault \
  ghcr.io/dennis-schaefer/siegmund-backend:latest
```

Or, preferably, use the example [`docker-compose.yaml`](./docker-compose.yaml)
in this directory:

```sh
docker compose pull
docker compose up -d
```

## Configuration

### Environment variables

Secrets are provided **only via environment variables** — never committed to the
repository or the Vault (ADR-0001). Derived from ADR-0001/0003 and the MVP PRD:

| Variable             | Required                    | Purpose                                                                                          |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY`  | recommended (fallback)      | Agent-lane fallback. The agent normally runs on the user's Anthropic subscription; this key is used when subscription usage limits are hit (ADR-0003). |
| `OPENROUTER_API_KEY` | one utility-lane key        | Utility-lane provider key (transcript cleanup, pre-classification, area matching).                |
| `OPENAI_API_KEY`     | alternative to the above    | Utility-lane provider key if using OpenAI instead of OpenRouter.                                  |
| `PORT`               | no (default `3000`)         | HTTP port the backend listens on.                                                                |
| `HOST`               | no (default `0.0.0.0`)      | Bind address.                                                                                     |

You only need the utility-lane key matching the provider you configure.

### Persistent volumes

Two volumes hold state that must survive container recreation:

| Mount path | Holds                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------- |
| `/data`    | The SQLite operational-state database (job queue, device registry, scheduler/decision state). |
| `/vault`   | The Vault git working clone the backend reads, commits, and pushes (the knowledge store).      |

Back up the `/data` volume to preserve operational state; the Vault working
clone under `/vault` is reconstructable from its git remote.

### Port mapping

The container listens on `3000`. The examples map host `3000:3000`; change the
host side if `3000` is already in use.

### Restart policy

The examples use `restart: unless-stopped` (compose) / `--restart unless-stopped`
(`docker run`) so the always-on backend comes back after crashes and host
reboots.

### Healthcheck

The image ships a built-in `HEALTHCHECK` that runs a node probe against
`GET /health`. The compose file mirrors it so the probe is visible there.

## Updating to a new version

Updating is a generic pull-and-recreate, done manually.

With compose:

```sh
# Pin a new version tag in docker-compose.yaml (e.g. v1.2.3), then:
docker compose pull
docker compose up -d   # recreates the container with the new image
```

With `docker run`:

```sh
docker pull ghcr.io/dennis-schaefer/siegmund-backend:v1.2.3
docker stop siegmund-backend && docker rm siegmund-backend
# re-run `docker run ...` with the new tag (same volumes/env as above)
```

Because operational state and the Vault clone live in volumes, recreating the
container does not lose data.
