# Möbius identity contracts

## Local bridge

`identity-bridge.openapi.yaml` is the only mini-app contract. `GET /api/identity` explicitly returns `account_mode`, `account_unavailable`, nullable `profile`, and a deployment list that always contains the local deployment. No `managed` boolean or `profile.username` exists.

Managed and linked upstream outages return HTTP 200 so the local deployment remains usable: the retained mode is preserved and `account_unavailable` is true. The UI must not call that connected or enable remote edits. Transport or malformed-response failures remain initial-load errors.

The bridge uses configurable `MOBIUS_ACCOUNT_ORIGIN`, defaulting to `https://www.mobius.you`. Its client origin must be exact HTTPS or loopback. Link start does not preflight the authorization page; popup navigation is authoritative.

Mini-apps retain their opaque-origin CSP sandbox. Account-link completion targets `window.opener.top` at the signed exact client origin; the top-level shell performs a one-state, one-frame, short-lived forward to the reviewed Identity app. Moving the account host to another machine changes `MOBIUS_ACCOUNT_ORIGIN` and host deployment configuration, not this browser trust model or the local bridge.

## Managed host

`launcher.openapi.yaml` is the private server-to-server contract. Requests use the per-instance bearer and `X-Mobius-Instance-Id`; the host derives the owner and ignores caller-supplied user IDs. Profile handles are normalized and database-unique. Avatar uploads are decoded/re-encoded with metadata removed. Instance secrets are hashed, compared safely, and revoked with the instance.

The deployment-local bridge overwrites user ID/email from the authenticated local binding and merges the local current deployment. App credentials and account-link grants never reach the mini-app.
