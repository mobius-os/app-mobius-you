# Self-hosted account linking — v2

Managed deployments use their instance binding and never run this flow. A signed-out self-hosted owner chooses Google or Apple inside Möbius · You.

1. The app opens a blank popup. If blocked, it stops before creating a link attempt.
2. Local `POST /api/identity/link/start` creates state and a PKCE verifier/challenge. It returns `authorization_url`, `attempt`, `state`, and `expires_at`. The origin comes from configurable `MOBIUS_ACCOUNT_ORIGIN`; the exact HTTPS or loopback `client_origin` is signed into the request.
3. Before navigation, the opaque Identity frame registers the returned state, authorization origin, and expiry with the top-level shell. The shell accepts this only from the exact live frame when the installed app has the reviewed `identity_manage` grant, and acknowledges the same state. No generic cross-origin message relay is exposed.
4. After the acknowledgement, the popup navigates to `/connect/mobius`. mobius.you authenticates with Google or Apple, obtains consent, and binds request, consent, authorization code, grant, and exact `postMessage` target to that client origin. There is no caller-controlled redirect.
5. The completion page posts `{type:"mobius-account-link",code,state}` to `window.opener.top` only at the exact shell origin. The shell validates the authorization origin, state, exact shape, local lifetime, reviewed grant, and still-mounted registered frame. It forwards `{type:"moebius:account-link-result",code,state,authorizationOrigin}` only to that exact frame and consumes the registration. The frame accepts the result only from its parent at the shell origin with the expected authorization origin and state; malformed and unrelated messages are ignored. `"*"` is used only for the shell-to-opaque-frame target, where trust is the exact `contentWindow` rather than a serializable origin.
6. The app closes the popup and sends code/state/attempt in the body of local `POST /api/identity/link/complete`. The PKCE verifier remains backend-only. Neither code nor verifier is put in a URL, log, or browser storage.
7. The backend exchanges at `/api/account-links/token`. Exchange is retry-idempotent and returns `{access_token,token_type,scope,identity}`. If the local response is lost, the app reads `GET /api/identity` first. It retries only while success remains unconfirmed and keeps the retry payload only in the open dialog's memory.
8. Only one grant is active per client origin. Relinking revokes the prior grant.

The app detects a blocked popup, broker refusal/timeout, user close, local timeout, and cancellation, and cleans its listener, timers, registration and popup on every terminal path. Completion cannot be cancelled mid-request, avoiding a hidden success racing a dismissed dialog.

`DELETE /api/identity/link` remotely revokes before deleting the local link. If revocation cannot be confirmed, the local link is retained and the app says nothing was disconnected. Unlinking does not sign out of mobius.you or affect managed deployments.
