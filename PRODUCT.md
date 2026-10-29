# Möbius · You

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One Möbius owner managing their identity and deployments from inside their own installation. Managed Railway owners arrive already authenticated; self-hosted owners may explicitly link a mobius.you account.

## Product Purpose

Möbius · You makes one handle the person's identity across Möbius, keeps private account details secondary, and provides a native place to see and manage every Möbius deployment attached to that account.

## Positioning

Identity and deployment observability live inside the owner's Möbius. Operations that can spend money, destroy data or open Recovery belong to the signed-in account dashboard; the app provides clear upfront navigation without exposing credentials.

## Operating Context

The app runs in a capability-sandboxed Möbius frame. mobius.you owns account identity, global handle uniqueness, account-link grants, Railway connections, and managed deployment operations. The local Möbius backend mediates every privileged request.

## Capabilities and Constraints

- Account modes are exactly signed out, linked self-hosted, or managed.
- The current local deployment remains visible when signed out or when the account service is unavailable.
- Handles are mandatory account identity, normalized to lowercase, and claimed against a server-side uniqueness constraint.
- Email may be stored privately for account access and displayed to the owner; provider-supplied names are not primary identity and should not be displayed.
- Provider credentials, Railway credentials, account-link grants, and PKCE verifiers never enter the mini-app.
- An uploaded or adopted provider avatar is stored only after the owner chooses it.
- Read-only deployment information, rename, plan refresh and provider-consented connection remain local; account-wide infrastructure mutations require the account dashboard owner session.
- Creation, resource changes, retries, deletion/cancellation, missing-project removal, Recovery start and Railway disconnect are explicit dashboard handoffs, never local forms or automatic cleanup. Direct Railway links remain available when the project is not deleting.
- Existing stored personal data is never erased by an interface update. Any retention migration is explicit, reviewed, and never a direct production database edit.

## Brand Commitments

- Product name: Möbius · You.
- App icon: the canonical Möbius mark rotated 180 degrees.
- The app follows the Möbius platform's theme, typography, surfaces, spacing, controls, focus language, light/dark modes, and accessibility conventions.
- mobius.you is an account provider, not the app's visual theme.

## Evidence on Hand

- Canonical rotated icon: `icon.png`.
- Current identity and account-link contracts: `identity-bridge.openapi.yaml`, `account-link.openapi.yaml`, and `launcher.openapi.yaml`.
- Current app and contract tests: `identity-contract.test.mjs`.

## Product Principles

1. The handle is the identity; provider details are private supporting context.
2. Show only confirmed state and retain a useful local path through outages.
3. Privileged credentials stay behind narrow server-owned capabilities.
4. Destructive deployment actions require deliberate intent.
5. Feel native to Möbius on every theme and viewport.
