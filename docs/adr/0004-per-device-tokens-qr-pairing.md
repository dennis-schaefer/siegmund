# Authentication: per-device bearer tokens, QR pairing, network layer is orthogonal

Every client request carries a **bearer token over HTTPS** — this is the
mandatory, application-level security feature and part of the software itself.
Network-level reachability (Tailscale / Cloudflare Tunnel / public HTTPS) is an
**orthogonal deployment choice** that can be changed freely without touching the
app; it only adds defense-in-depth on top of the token.

**Per-device tokens, not one shared secret.** Pairing uses a QR flow:
`siegmund pair "<device name>"` generates a short-lived, single-use enrollment
code and prints it as a QR (with the baseUrl) to the server console. The app
scans it and exchanges it at `POST /pair` for its own per-device token, stored
in the OS keystore (Expo SecureStore). The QR thus never carries the long-lived
secret.

Issued tokens live in a SQLite **device registry** (`device_name`,
`token_hash` — never the raw token, `created_at`, `last_used_at`, optional
`last_used_ip`, `status`, `revoked_at`). The auth middleware looks up each
request's token by hash; unknown or `revoked` → 401, otherwise `last_used_at`
is updated. Management is CLI-only (`siegmund devices`, `siegmund revoke`) to
avoid an extra attack surface.

## Consequences

- A lost device is revoked with one command without re-keying other devices.
- Tokens are unrecoverable (only hashes stored); a lost token is re-issued by
  re-pairing.
- Capture input is treated as untrusted (prompt-injection); the tiered
  permission gate from ADR-0003 is the second line of defense.
