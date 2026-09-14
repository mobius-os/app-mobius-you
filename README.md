# Möbius · You

Your Möbius account, profile, deployments, and model access — inside your own Möbius. A [Möbius](https://github.com/mobius-os) mini-app.

Signed out, it shows only this local deployment. After you link a mobius.you account (or on a managed deployment, automatically), it shows your `@handle`, keeps private account details secondary, and gives you a native place to see and manage every Möbius deployment on that account. Account credentials stay in the Möbius backend; the mini-app receives only its ordinary app token.

## Install

### Via the App Store (recommended)

Open the **App Store** mini-app in Möbius, search for "Möbius · You", tap **Install**. Möbius will ask you to approve the `identity_manage` and `railway_manage` capabilities before it can read your account or manage deployments.

### Via paste-a-URL

In the App Store, choose **Install from URL** and paste:

```
https://raw.githubusercontent.com/mobius-os/app-mobius-you/main/mobius.json
```

## Identity model

The handle is the primary visible identity. Provider-supplied display names are not rendered, and the account email is labelled private. An available account without a handle must claim one before using the rest of the profile surface; the server remains the final authority for global uniqueness.

The app consumes only the v2 local bridge (`identity-bridge.openapi.yaml`):

- `account_mode` is exactly `signed_out`, `linked`, or `managed`.
- `account_unavailable` reports a temporary upstream failure without pretending the account is connected.
- `profile` is `null` while signed out. Email is nullable because managed enrollment can intentionally omit it. A managed outage may retain only the locally bound user ID and any available email; a linked outage does not expose stale profile data.
- `deployments` always includes the local deployment.

Self-hosted linking uses the deployed mobius.you protocol (`account-link.openapi.yaml`). The backend chooses `MOBIUS_ACCOUNT_ORIGIN` (default `https://www.mobius.you`) and binds the request, consent, code, grant, and popup message target to the exact HTTPS or loopback client origin. Codes and PKCE verifiers never enter URLs, logs, or browser storage. Avatar bytes are proxied through the authenticated `GET /api/identity/avatar` so the frame's restrictive same-origin image policy stays intact even when the account host moves to another machine.

## Model access

Linked and managed accounts can see their current model credit, activate an available trial, and expand a provider-neutral catalogue of model aliases and token prices. The app reads `GET /api/identity/agent` and activates the trial through `POST /api/identity/agent/trial`; routing identifiers and provider credentials stay behind the local identity bridge.

During the limited test, the account service supplies a fixed notice that conversations sent through Möbius models are stored privately for testing and improvement. This is an informational notice, not a consent control or activation gate. If the shared trial fund is empty, the activation action explains that the account is ready and that the Möbius owner can add more capacity.

## Railway management

Railway control is a separate reviewed permission from identity management. A new account link explicitly grants Railway inventory/write access and a separate deployment-deletion scope; older identity-only links remain valid for profile reads but must reconnect before infrastructure controls appear.

The app reads `GET /api/identity/railway`, creates deployments, lets owners choose automatic or manual verified-image updates, updates CPU/RAM and grows storage, retries failed operations, and requires an in-app confirmation before deletion. Railway OAuth opens in a popup from a short-lived, account-bound URL; the app polls the authoritative inventory for completion, so Railway codes and credentials never enter the frame. If Railway reports an ambiguous deletion failure, the app performs a read-only diagnosis and only offers local record removal after the server confirms the project is absent; retrying deletion remains explicit.

## Development

```
npm test        # runs the contract tests (node --test, no extra deps)
```

`index.jsx` is the entry; `identity-contract.js` and `identity-styles.js` are the installed runtime files. The OpenAPI specs and `*.md` contracts in this repo are reference documentation, not installed source.

## License

MIT — see [LICENSE](LICENSE).
