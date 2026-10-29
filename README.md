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

The installed manifest declares the Möbius Responses endpoint and model list.
The platform's protected local broker still handles account authentication and
inference, while the same app-model registry used by external connectors
populates chat and background-agent model choices. The default-on visibility
switch uses `GET/PATCH /api/auth/providers/mobius/enabled`; it does not require
an account link, and disabling it does not delete existing chats.

During the limited test, the account service supplies a fixed notice that conversations sent through Möbius models are stored privately for testing and improvement. This is an informational notice, not a consent control or activation gate. If the shared trial fund is empty, the activation action explains that the account is ready and that the Möbius owner can add more capacity.

## Railway management

Railway control is a separate reviewed permission from identity management. A new account link explicitly grants Railway inventory/write access and a separate deployment-deletion scope; older identity-only links remain valid for profile reads but must reconnect before infrastructure controls appear.

The app reads the Railway inventory, per-workspace plans and live resource metrics. It shows deployment status, resource caps, region, persistence status and, when advertised, display-only Railway usage/cost information. Unknown usage is hidden rather than presented as zero. Rename remains a local action relayed through the backend; the account service owns the deployment name.

Creating, retrying, deleting, cancelling, resizing, starting Recovery, removing a missing-project card and disconnecting Railway require the owner's signed-in mobius.you dashboard. The app links there **before** asking for any settings or confirmation; it never submits these operations. Failed and deletion-failed cards both offer a manual card-removal handoff with a warning that a hidden Railway project may still be running and billed. Opening a deployment requires confirmed ready/active state; deleting deployments also disable their Railway link. Container replacement stays in Möbius Settings.

The app opts into `GET /api/identity/railway?workspace_ids=1&dashboard=1`; `dashboard_url` comes from the platform's configured account origin rather than a hard-coded host. Older platforms omit it, so protected-action links remain unavailable with an update explanation—never a fallback mutation. Live metrics opt into `?cost=1` and tolerate older servers that omit cost. Release the launcher read extension and platform bridge before this app; owner-only restrictions remain enforced independently on both servers.

Railway connect/change-account still uses the existing provider consent popup, and plan refresh remains available. Codes and credentials never enter the frame.

## Development

```
npm ci
npm test        # contract and exact-source rendered-component tests
```

`index.jsx` is the entry; `identity-contract.js` and `identity-styles.js` are the installed runtime files. The OpenAPI specs and `*.md` contracts in this repo are reference documentation, not installed source.

## License

MIT — see [LICENSE](LICENSE).
