export const IDENTITY_STYLES = `
* { box-sizing: border-box; }

button,
input { font: inherit; }

button { user-select: none; -webkit-user-select: none; }

.id-root {
  --id-radius: 16px;
  --id-control-radius: 12px;
  min-height: 100%;
  overflow: auto;
  padding: clamp(18px, 3.5vw, 44px);
  background: var(--bg, #0d0d0d);
  color: var(--text, #f5f5f5);
  font-family: var(--font, Inter, ui-sans-serif, system-ui, sans-serif);
  user-select: text;
  -webkit-user-select: text;
}

.id-shell {
  width: min(1060px, 100%);
  margin: 0 auto;
}

.id-top,
.id-brand,
.id-status,
.id-value-row,
.id-title-row,
.id-email {
  display: flex;
  align-items: center;
}

.id-top {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: clamp(24px, 4vw, 38px);
  padding-bottom: 17px;
  border-bottom: 1px solid var(--border-light, var(--border, #2a2a2a));
}

.id-brand {
  min-width: 0;
  gap: 10px;
}

.id-brand img {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border-radius: 8px;
}

.id-brand strong {
  display: block;
  color: var(--text, #f5f5f5);
  font-size: 16px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: -.015em;
}

.id-kicker {
  margin-top: 2px;
  color: var(--muted, #999);
  font-size: 11px;
  line-height: 1.3;
}

.id-status {
  min-width: 0;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid var(--border-light, var(--border, #2a2a2a));
  border-radius: 999px;
  background: var(--surface, #171717);
  color: var(--muted, #999);
  font-size: 12px;
  font-weight: 550;
  text-align: right;
}

.id-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.id-dot--online { background: var(--success, #38b86c); }
.id-dot--muted { background: var(--muted, #777); }
.id-dot--warning { background: var(--warning, #d9982f); }
.id-dot--error { background: var(--danger, #d65a5a); }

.id-auth {
  min-height: 330px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  max-width: 780px;
  padding: 34px 8px 48px;
}

.id-auth h1 {
  max-width: 720px;
  margin: 0 0 18px;
  color: var(--text, #f5f5f5);
  font-size: clamp(44px, 7vw, 76px);
  font-weight: 720;
  line-height: .98;
  letter-spacing: -.04em;
  text-wrap: balance;
}

.id-auth > p {
  max-width: 650px;
  margin: 0;
  color: var(--muted, #999);
  font-size: 16px;
  line-height: 1.6;
}

.id-auth-button {
  min-width: 190px;
  margin-top: 28px;
}

.id-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: clamp(18px, 3vw, 26px);
  margin-bottom: 18px;
  padding: clamp(20px, 3vw, 28px);
  border: 1px solid color-mix(in srgb, var(--accent, #8b7cf6) 20%, var(--border, #2a2a2a));
  border-radius: 20px;
  background:
    radial-gradient(circle at 0 0, color-mix(in srgb, var(--accent, #8b7cf6) 10%, transparent), transparent 44%),
    var(--surface, #171717);
  box-shadow: 0 16px 42px color-mix(in srgb, var(--bg, #0d0d0d) 55%, transparent);
}

.id-profile-copy { min-width: 0; }

.id-avatar {
  position: relative;
  width: clamp(82px, 8vw, 96px);
  aspect-ratio: 1;
  overflow: hidden;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent, #8b7cf6) 26%, var(--border, #2a2a2a));
  border-radius: 24px;
  background: color-mix(in srgb, var(--accent, #8b7cf6) 18%, var(--surface-2, #222));
  color: var(--text, #fff);
  font-size: 34px;
  font-weight: 720;
  letter-spacing: -.05em;
}

.id-avatar.is-disabled { filter: saturate(.45); }

.id-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.id-avatar-edit {
  position: absolute;
  right: 7px;
  bottom: 7px;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border, #333);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface, #171717) 92%, transparent);
  box-shadow: 0 6px 18px rgba(0, 0, 0, .18);
  color: var(--text, #fff);
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.id-title-row {
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.id-title {
  min-width: 0;
  margin: 0;
  color: var(--text, #f5f5f5);
  font-size: clamp(32px, 3.8vw, 42px);
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: -.035em;
  overflow-wrap: anywhere;
}

.id-handle-btn,
.id-copy,
.id-open {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--muted, #999);
  cursor: pointer;
}

.id-handle-btn {
  width: 42px;
  height: 42px;
}

.id-identity-caption {
  margin-top: 9px;
  color: var(--muted, #999);
  font-size: 14px;
}

.id-email {
  width: fit-content;
  max-width: 100%;
  gap: 7px;
  margin-top: 16px;
  padding: 7px 9px;
  border: 1px solid var(--border-light, var(--border, #2a2a2a));
  border-radius: 999px;
  background: var(--surface-2, #222);
  color: var(--text, #f5f5f5);
  font-size: 12px;
}

.id-email > span:first-of-type {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.id-private-label {
  padding-left: 7px;
  border-left: 1px solid var(--border, #333);
  color: var(--muted, #999);
}

.id-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(270px, .65fr);
  align-items: start;
  gap: 18px;
}

.id-card {
  min-width: 0;
  padding: 22px;
  border: 1px solid var(--border, #2a2a2a);
  border-radius: var(--id-radius);
  background: var(--surface, #171717);
}

.id-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 13px;
}

.id-card-actions,
.id-deploy-actions,
.id-manage-links,
.id-delete-confirm > div {
  display: flex;
  align-items: center;
  gap: 7px;
}

.id-card-actions { justify-content: flex-end; }

.id-card h2 {
  margin: 0;
  color: var(--text, #f5f5f5);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -.01em;
}

.id-card-sub,
.id-label,
.id-deploy-meta { color: var(--muted, #999); }

.id-card-sub {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.45;
}

.id-deployments,
.id-data { display: grid; }

.id-deployment {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  padding: 14px 0;
  border-top: 1px solid var(--border-light, var(--border, #2a2a2a));
}

.id-deployment:first-child { border-top: 0; }

.id-deploy-mark {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: color-mix(in srgb, var(--accent, #8b7cf6) 12%, var(--surface-2, #222));
}

.id-deploy-mark img {
  width: 26px;
  height: 26px;
}

.id-deploy-name,
.id-value { overflow-wrap: anywhere; }

.id-deploy-name {
  min-width: 0;
  color: var(--text, #f5f5f5);
  font-size: 14px;
  font-weight: 620;
}

.id-deploy-meta {
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.4;
}

.id-open,
.id-copy {
  width: 40px;
  height: 40px;
}

.id-deploy-actions { justify-content: flex-end; }

.id-data { gap: 0; }

.id-field {
  min-width: 0;
  padding: 14px 0;
  border-top: 1px solid var(--border-light, var(--border, #2a2a2a));
}

.id-field:first-child {
  padding-top: 2px;
  border-top: 0;
}

.id-label {
  margin-bottom: 6px;
  font-size: 11px;
}

.id-value-row {
  min-width: 0;
  justify-content: space-between;
  gap: 8px;
}

.id-value {
  min-width: 0;
  color: var(--text, #f5f5f5);
  font-size: 13px;
  font-weight: 600;
}

.id-btn {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 16px;
  border: 1px solid var(--border, #333);
  border-radius: var(--id-control-radius);
  background: var(--surface-2, #222);
  color: var(--text, #f5f5f5);
  font-weight: 650;
  cursor: pointer;
}

.id-btn--small {
  min-height: 38px;
  padding: 0 12px;
  font-size: 12px;
}

.id-btn--primary {
  border-color: var(--accent, #8b7cf6);
  background: var(--accent, #8b7cf6);
  color: var(--accent-contrast, #fff);
}

.id-btn--danger {
  border-color: color-mix(in srgb, var(--danger, #d65a5a) 50%, var(--border, #333));
  background: color-mix(in srgb, var(--danger, #d65a5a) 14%, var(--surface, #171717));
  color: var(--danger, #e67a7a);
}

.id-btn--quiet {
  width: 100%;
  margin-top: 10px;
  border-color: color-mix(in srgb, var(--danger, #d65a5a) 28%, var(--border, #333));
  background: transparent;
  color: var(--danger, #e67a7a);
}

.id-btn:disabled,
.id-provider:disabled,
.id-avatar-edit:disabled,
.id-copy:disabled {
  opacity: .52;
  cursor: default;
}

.id-railway-callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 6px 0 10px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--accent, #8b7cf6) 25%, var(--border, #333));
  border-radius: 13px;
  background: color-mix(in srgb, var(--accent, #8b7cf6) 8%, var(--surface-2, #222));
}

.id-railway-callout strong,
.id-railway-callout span { display: block; }

.id-railway-callout strong {
  color: var(--text, #f5f5f5);
  font-size: 13px;
}

.id-railway-callout span {
  max-width: 52ch;
  margin-top: 3px;
  color: var(--muted, #999);
  font-size: 12px;
  line-height: 1.45;
}

.id-avatar-edit:focus-visible,
.id-btn:focus-visible,
.id-copy:focus-visible,
.id-handle-btn:focus-visible,
.id-open:focus-visible,
.id-provider:focus-visible,
.id-input--boxed:focus-visible {
  outline: 2px solid var(--accent, #8b7cf6);
  outline-offset: 2px;
}

.id-notice {
  display: grid;
  gap: 5px;
  margin: -10px 0 18px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--warning, #d9982f) 38%, var(--border, #333));
  border-radius: 13px;
  background: color-mix(in srgb, var(--warning, #d9982f) 9%, var(--surface, #171717));
  color: var(--text, #f5f5f5);
}

.id-notice span {
  color: var(--muted, #999);
  font-size: 13px;
  line-height: 1.5;
}

.id-notice--error {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  border-color: color-mix(in srgb, var(--danger, #d65a5a) 38%, var(--border, #333));
  background: color-mix(in srgb, var(--danger, #d65a5a) 9%, var(--surface, #171717));
}

.id-notice--error .id-btn {
  grid-row: 1 / span 2;
  grid-column: 2;
}

.id-error,
.id-signin-error {
  color: var(--danger, #e67a7a);
  font-size: 13px;
  line-height: 1.5;
}

.id-error {
  padding: 20px 12px;
  text-align: center;
}

.id-signin-error { margin-top: 12px; }

.id-loading {
  min-height: 420px;
  display: grid;
  place-items: center;
  color: var(--muted, #999);
}

.id-fatal { max-width: 620px; }

.id-fatal h1 {
  margin: 0 0 10px;
  color: var(--text, #f5f5f5);
  font-size: 28px;
}

.id-fatal p {
  margin: 0 0 20px;
  color: var(--muted, #999);
  line-height: 1.55;
}

.id-modal-backdrop {
  position: fixed;
  z-index: 20;
  inset: 0;
  min-height: 100dvh;
  overflow: auto;
  display: grid;
  place-items: center;
  padding: 18px;
  background: color-mix(in srgb, var(--bg, #0d0d0d) 76%, transparent);
  backdrop-filter: blur(8px);
}

.id-modal {
  width: min(500px, 100%);
  max-height: calc(100dvh - 36px);
  overflow: auto;
  padding: 25px;
  border: 1px solid var(--border, #333);
  border-radius: 18px;
  background: var(--surface, #171717);
  box-shadow: 0 26px 72px rgba(0, 0, 0, .28);
}

.id-modal h2 {
  margin: 0 0 7px;
  color: var(--text, #f5f5f5);
  font-size: 22px;
  letter-spacing: -.025em;
}

.id-modal > p {
  max-width: 54ch;
  margin: 0 0 20px;
  color: var(--muted, #999);
  font-size: 14px;
  line-height: 1.55;
}

.id-handle-preview {
  width: fit-content;
  max-width: 100%;
  margin-bottom: 14px;
  overflow: hidden;
  color: var(--accent, #8b7cf6);
  font-size: 18px;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.id-input-wrap {
  display: flex;
  align-items: center;
  padding: 0 13px;
  border: 1px solid var(--border, #333);
  border-radius: 12px;
  background: var(--surface-2, #222);
}

.id-input-wrap:focus-within {
  border-color: var(--accent, #8b7cf6);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #8b7cf6) 15%, transparent);
}

.id-input-prefix { color: var(--muted, #999); }

.id-input {
  min-width: 0;
  width: 100%;
  height: 46px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text, #f5f5f5);
}

.id-input--boxed {
  width: 100%;
  margin-top: 6px;
  padding: 0 12px;
  border: 1px solid var(--border, #333);
  border-radius: 11px;
  background: var(--surface-2, #222);
}

.id-check-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 11px;
  margin-top: 18px;
  color: var(--text, #f5f5f5);
  cursor: pointer;
}

.id-check-row input {
  width: 18px;
  height: 18px;
  margin: 2px 0 0;
  accent-color: var(--accent, #8b7cf6);
}

.id-check-row strong,
.id-check-row small { display: block; }
.id-check-row strong { font-size: 13px; }
.id-check-row small {
  margin-top: 3px;
  color: var(--muted, #999);
  font-size: 12px;
  line-height: 1.45;
}

.id-manage-modal { width: min(620px, 100%); }

.id-manage-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.id-manage-head p {
  margin: 5px 0 0;
  color: var(--muted, #999);
  font-size: 13px;
}

.id-plan {
  padding: 6px 8px;
  border-radius: 999px;
  background: var(--surface-2, #222);
  color: var(--muted, #999);
  font-size: 11px;
  text-transform: capitalize;
}

.id-resource-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 17px 0;
  border-top: 1px solid var(--border-light, var(--border, #2a2a2a));
  border-bottom: 1px solid var(--border-light, var(--border, #2a2a2a));
}

.id-resource-save { grid-column: 1 / -1; }

.id-select {
  width: 100%;
  height: 46px;
  padding: 0 36px 0 12px;
  border: 1px solid var(--border, #333);
  border-radius: 11px;
  background-color: var(--surface-2, #222);
  color: var(--text, #f5f5f5);
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
  cursor: pointer;
}

.id-select:disabled { opacity: .55; cursor: default; }

.id-resource-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.id-field-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.id-field-block small {
  color: var(--muted, #999);
  font-size: 11px;
  line-height: 1.4;
}

.id-manage-resources {
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding: 17px 0;
  border-top: 1px solid var(--border-light, var(--border, #2a2a2a));
  border-bottom: 1px solid var(--border-light, var(--border, #2a2a2a));
}

.id-storage-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 12px;
}

.id-storage-row .id-btn { white-space: nowrap; }

.id-railway-connection {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 2px 0 12px;
  color: var(--muted, #999);
  font-size: 12px;
}

.id-railway-conn-account {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.id-railway-plan {
  flex: 0 0 auto;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--surface-2, #222);
  color: var(--muted, #999);
  font-size: 11px;
  text-transform: capitalize;
}

.id-railway-manage {
  flex: 0 0 auto;
  margin-left: auto;
  padding: 4px 12px;
  border: 1px solid var(--border, #333);
  border-radius: 999px;
  background: transparent;
  color: var(--text, #f5f5f5);
  font-size: 12px;
  cursor: pointer;
}

.id-railway-manage:hover { background: var(--surface-2, #222); }

.id-metrics {
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding: 2px 0 17px;
  border-bottom: 1px solid var(--border-light, var(--border, #2a2a2a));
}

.id-metrics-runtime {
  color: var(--muted, #999);
  font-size: 12px;
}

.id-metrics-note {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0 17px;
  color: var(--muted, #999);
  font-size: 12px;
  border-bottom: 1px solid var(--border-light, var(--border, #2a2a2a));
}

.id-meters {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.id-meter {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.id-meter-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.id-meter-label {
  color: var(--muted, #999);
  font-size: 10px;
  letter-spacing: .05em;
  text-transform: uppercase;
}

.id-meter-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text, #f5f5f5);
  font-size: 12px;
}

.id-meter-limit { color: var(--muted, #999); }

.id-meter-track {
  height: 6px;
  border-radius: 999px;
  background: var(--surface-2, #222);
  overflow: hidden;
}

.id-meter-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--accent, #8b7cf6);
  transition: width .3s ease;
}

.id-recovery {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 2px;
}

.id-recovery-note {
  font-size: 12px;
  line-height: 1.4;
  color: var(--muted, #999);
}

.id-recovery-note.is-error { color: var(--danger, #f87171); }

.id-recovery-hint {
  color: var(--muted, #999);
  font-size: 11px;
  line-height: 1.4;
}

.id-railway-callout--warn {
  border-color: color-mix(in srgb, #e5a13a 42%, var(--border, #333));
  background: color-mix(in srgb, #e5a13a 12%, var(--surface-2, #222));
}

.id-manage-links {
  flex-wrap: wrap;
  margin-top: 18px;
}

.id-manage-error,
.id-delete-confirm {
  margin-top: 15px;
  padding: 13px;
  border-radius: 12px;
}

.id-manage-error {
  background: color-mix(in srgb, var(--danger, #d65a5a) 10%, var(--surface-2, #222));
  color: var(--danger, #e67a7a);
  font-size: 12px;
  line-height: 1.45;
}

.id-delete-confirm {
  border: 1px solid color-mix(in srgb, var(--danger, #d65a5a) 35%, var(--border, #333));
  background: color-mix(in srgb, var(--danger, #d65a5a) 8%, var(--surface, #171717));
}

.id-delete-confirm strong,
.id-delete-confirm span { display: block; }
.id-delete-confirm strong { font-size: 13px; }
.id-delete-confirm span {
  margin: 4px 0 13px;
  color: var(--muted, #999);
  font-size: 12px;
}

.id-delete-trigger { margin-top: 18px; }
.id-modal-close { width: 100%; margin-top: 12px; }

.id-hint {
  min-height: 20px;
  margin-top: 8px;
  color: var(--muted, #999);
  font-size: 12px;
}

.id-hint.is-error { color: var(--danger, #e67a7a); }

.id-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 20px;
}

.id-lock {
  width: 44px;
  height: 44px;
  margin: 0 0 18px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: color-mix(in srgb, var(--accent, #8b7cf6) 13%, var(--surface-2, #222));
  color: var(--accent, #8b7cf6);
}

.id-provider-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.id-provider {
  width: 100%;
  min-height: 48px;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 10px;
  padding: 0 13px;
  border: 1px solid #dadce0;
  border-radius: 12px;
  background: #fff;
  color: #171717;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  transition: background 150ms ease, transform 150ms ease;
}

.id-provider-mark,
.id-provider-balance {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
}

.id-provider-mark svg {
  display: block;
  width: 20px;
  height: 20px;
}

.id-provider-copy {
  grid-column: 2;
  text-align: center;
  white-space: nowrap;
}

.id-progress {
  min-height: 22px;
  margin-top: 13px;
  color: var(--muted, #999);
  font-size: 13px;
}

.id-retry-completion,
.id-cancel-signin {
  width: 100%;
  margin-top: 14px;
}

.id-cancel-signin {
  border-color: transparent;
  background: transparent;
  color: var(--muted, #999);
}

.id-spin { animation: id-spin 1s linear infinite; }

.id-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes id-spin { to { transform: rotate(360deg); } }

@media (hover: hover) {
  .id-open:hover,
  .id-copy:hover,
  .id-handle-btn:hover {
    background: var(--surface-2, #222);
    color: var(--text, #f5f5f5);
  }

  .id-btn:not(:disabled):hover { border-color: color-mix(in srgb, var(--accent, #8b7cf6) 45%, var(--border, #333)); }
  .id-btn--primary:not(:disabled):hover { filter: brightness(1.05); }
  .id-provider:not(:disabled):hover { background: #f4f4f4; transform: translateY(-1px); }
}

@media (max-width: 720px) {
  .id-root { padding: 16px; }

  .id-top {
    align-items: flex-start;
    margin-bottom: 22px;
  }

  .id-status {
    max-width: 45%;
    padding: 6px 8px;
  }

  .id-status-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .id-auth {
    min-height: 330px;
    padding: 26px 4px 38px;
  }

  .id-auth h1 { font-size: 48px; }

  .id-hero {
    grid-template-columns: 76px minmax(0, 1fr);
    gap: 16px;
    padding: 18px;
    border-radius: 17px;
  }

  .id-avatar {
    width: 76px;
    border-radius: 19px;
    font-size: 28px;
  }

  .id-avatar-edit {
    right: 3px;
    bottom: 3px;
    width: 33px;
    height: 33px;
  }

  .id-title { font-size: clamp(31px, 10vw, 42px); }
  .id-title-row { align-items: flex-start; }
  .id-identity-caption { margin-top: 6px; font-size: 12px; }
  .id-email { margin-top: 11px; }
  .id-private-label { display: none; }

  .id-grid,
  .id-provider-list { grid-template-columns: 1fr; }

  .id-card { padding: 18px; }

  .id-card-head { align-items: center; }
  .id-card-actions .id-btn--small { width: 38px; padding: 0; }
  .id-card-actions .id-btn--small svg { margin: 0; }
  .id-card-actions .id-btn--small { font-size: 0; }

  .id-railway-callout {
    align-items: stretch;
    flex-direction: column;
  }

  .id-railway-callout .id-btn { width: 100%; }

  .id-resource-grid { grid-template-columns: 1fr; }
  .id-resource-save { grid-column: auto; }
  .id-resource-fields { grid-template-columns: 1fr; }
  .id-meters { grid-template-columns: 1fr; }
  .id-storage-row { grid-template-columns: 1fr; align-items: stretch; }
  .id-storage-row .id-btn { width: 100%; }
  .id-manage-links { display: grid; grid-template-columns: 1fr; }
  .id-delete-confirm > div { align-items: stretch; flex-direction: column; }

  .id-notice--error { grid-template-columns: 1fr; }

  .id-notice--error .id-btn {
    grid-row: auto;
    grid-column: auto;
    width: 100%;
    margin-top: 8px;
  }

  .id-modal-actions { flex-direction: column-reverse; }
  .id-modal-actions .id-btn { width: 100%; }
}

@media (max-width: 430px) {
  .id-hero {
    grid-template-columns: 62px minmax(0, 1fr);
    padding: 15px;
  }

  .id-avatar { width: 62px; border-radius: 16px; }
  .id-avatar-edit { width: 30px; height: 30px; }
  .id-title { font-size: 30px; }
  .id-email { max-width: calc(100vw - 130px); }
}

@media (prefers-reduced-motion: reduce) {
  .id-spin { animation: none; }
  .id-provider { transition: none; }
}
`
