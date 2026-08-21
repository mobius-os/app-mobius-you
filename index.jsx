import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  ArrowRotateCw,
  ArrowUpRight,
  Check,
  Copy,
  Lock,
  Pencil,
  Plus,
  SettingsCog,
  Trash,
} from '@openai/apps-sdk-ui/components/Icon'

import {
  IdentityRequestError,
  accountStatus,
  parseIdentity,
  parseLinkAttempt,
  parseRailway,
  waitForAccountLink,
} from './identity-contract.js'
import { IDENTITY_STYLES } from './identity-styles.js'

async function identityRequest(token, path = '', options = {}) {
  let response
  try {
    response = await fetch(`/api/identity${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new IdentityRequestError(
      'This Möbius could not reach its identity service. Check your connection and try again.',
    )
  }

  if (response.status === 204) return null
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new IdentityRequestError(
      body.detail || 'Identity is unavailable right now.',
      response.status,
    )
  }
  if (path === '/link/start') return parseLinkAttempt(body)
  if (path === '/railway') return parseRailway(body)
  if (['', '/profile', '/avatar', '/link/complete'].includes(path)) {
    return parseIdentity(body)
  }
  return body
}

function initials(profile) {
  const value = profile?.handle || profile?.email || 'M'
  return value
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function useDialog(onClose, blocked, initialFocusRef) {
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)
  const blockedRef = useRef(blocked)
  closeRef.current = onClose
  blockedRef.current = blocked

  useEffect(() => {
    const previousFocus = document.activeElement
    const dialog = dialogRef.current
    const focusTimer = setTimeout(() => {
      const target = initialFocusRef?.current
        || dialog?.querySelector('button:not(:disabled), input:not(:disabled)')
        || dialog
      target?.focus?.()
    }, 0)

    const onKeyDown = event => {
      if (event.key === 'Escape') {
        if (!blockedRef.current) {
          event.preventDefault()
          closeRef.current()
        }
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      )]
      if (!focusable.length) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    dialog?.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(focusTimer)
      dialog?.removeEventListener('keydown', onKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  return dialogRef
}

function GoogleMark() {
  return (
    <span className="id-provider-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path fill="#4285f4" d="M21.4 12.2c0-.6-.1-1.2-.2-1.8H12v3.5h5.3a4.5 4.5 0 0 1-2 2.9v2.3h3.2c1.8-1.7 2.9-4.2 2.9-6.9Z" />
        <path fill="#34a853" d="M12 21.7c2.6 0 4.9-.9 6.5-2.4l-3.2-2.3c-.9.6-2 .9-3.3.9-2.6 0-4.7-1.7-5.5-4H3.3v2.3a9.8 9.8 0 0 0 8.7 5.5Z" />
        <path fill="#fbbc05" d="M6.5 14a5.8 5.8 0 0 1 0-3.9V7.8H3.3a9.8 9.8 0 0 0 0 8.5L6.5 14Z" />
        <path fill="#ea4335" d="M12 6.1c1.4 0 2.7.5 3.7 1.4l2.8-2.8A9.4 9.4 0 0 0 12 2.2a9.8 9.8 0 0 0-8.7 5.6l3.2 2.3c.8-2.3 2.9-4 5.5-4Z" />
      </svg>
    </span>
  )
}

function AppleMark() {
  return (
    <span className="id-provider-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M17.1 12.5c0-3.2 2.6-4.7 2.7-4.8a5.8 5.8 0 0 0-4.6-2.5c-1.9-.2-3.8 1.2-4.8 1.2s-2.5-1.1-4.2-1.1A6.2 6.2 0 0 0 1 8.5c-2.2 3.9-.6 9.5 1.6 12.6 1.1 1.5 2.3 3.2 4 3.2 1.6-.1 2.2-1 4.1-1s2.5 1 4.2 1c1.7 0 2.8-1.5 3.8-3.1a12.6 12.6 0 0 0 1.8-3.6 5.5 5.5 0 0 1-3.4-5.1ZM13.9 3.2A5.6 5.6 0 0 0 15.2-.8a5.6 5.6 0 0 0-3.7 1.9A5.3 5.3 0 0 0 10.2 5a4.7 4.7 0 0 0 3.7-1.8Z"
          transform="translate(1.2 1) scale(.9)"
        />
      </svg>
    </span>
  )
}

function Brand({ appId, status }) {
  return (
    <header className="id-top">
      <div className="id-brand">
        <img src={`/api/apps/${appId}/icon?size=64`} alt="" />
        <div>
          <strong>Möbius · You</strong>
          <div className="id-kicker">your Möbius account</div>
        </div>
      </div>
      <div className="id-status" role="status" aria-live="polite">
        <span className={`id-dot id-dot--${status.tone}`} aria-hidden="true" />
        <span className="id-status-label">{status.label}</span>
      </div>
    </header>
  )
}

function ProfileAvatar({ profile, token }) {
  const [source, setSource] = useState('')

  useEffect(() => {
    setSource('')
    if (!profile?.avatar_url) {
      return undefined
    }
    const controller = new AbortController()
    let objectUrl = ''
    ;(async () => {
      try {
        const response = await fetch('/api/identity/avatar', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        if (!response.ok) return
        const blob = await response.blob()
        if (!blob.type.startsWith('image/')) return
        objectUrl = URL.createObjectURL(blob)
        setSource(objectUrl)
      } catch { /* initials remain the privacy-safe fallback */ }
    })()
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [profile?.avatar_url, token])

  return source ? <img src={source} alt="" /> : initials(profile)
}

function HandleModal({ current, onClose, onSave, required = false }) {
  const [value, setValue] = useState(current || '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const dialogRef = useDialog(onClose, pending || required, inputRef)
  const valid = /^[a-z0-9_]{3,30}$/.test(value)

  const save = async event => {
    event.preventDefault()
    if (!valid || pending) return
    setPending(true)
    setError('')
    try {
      await onSave(value)
      onClose()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      className="id-modal-backdrop"
      onMouseDown={event => {
        if (!pending && !required && event.target === event.currentTarget) onClose()
      }}
    >
      <form
        ref={dialogRef}
        className="id-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="handle-title"
        aria-describedby="handle-description handle-hint"
        aria-busy={pending}
        tabIndex={-1}
        onSubmit={save}
      >
        <div className="id-handle-preview" aria-hidden="true">
          @{value || 'you'}
        </div>
        <h2 id="handle-title">
          {required ? 'Choose your Möbius handle' : 'Change your handle'}
        </h2>
        <p id="handle-description">
          Your handle is your unique identity across Möbius. It is public when you choose to use it; your email stays private.
        </p>
        <label className="id-label" htmlFor="identity-handle">Handle</label>
        <div className="id-input-wrap">
          <span className="id-input-prefix" aria-hidden="true">@</span>
          <input
            ref={inputRef}
            id="identity-handle"
            className="id-input"
            value={value}
            maxLength={30}
            autoComplete="username"
            spellCheck="false"
            aria-invalid={Boolean(error) || !valid}
            aria-describedby="handle-hint"
            disabled={pending}
            onChange={event => {
              setValue(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
              setError('')
            }}
          />
        </div>
        <div
          id="handle-hint"
          className={`id-hint${error ? ' is-error' : ''}`}
          role={error ? 'alert' : undefined}
        >
          {error || (valid
            ? 'Available handles are confirmed when you save.'
            : 'Use 3–30 letters, numbers or underscores.')}
        </div>
        <div className="id-modal-actions">
          {!required && (
            <button type="button" className="id-btn" disabled={pending} onClick={onClose}>
              Cancel
            </button>
          )}
          <button type="submit" className="id-btn id-btn--primary" disabled={!valid || pending}>
            {pending ? 'Claiming…' : required ? 'Claim handle' : 'Save handle'}
          </button>
        </div>
      </form>
    </div>
  )
}

function SignInModal({ token, onClose, onSignedIn }) {
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const [completion, setCompletion] = useState(null)
  const popupRef = useRef(null)
  const waitAbortRef = useRef(null)
  const completionAbortRef = useRef(null)
  const completionBusyRef = useRef(false)
  const startBusyRef = useRef(false)
  const firstProviderRef = useRef(null)

  const cleanupWait = useCallback(() => {
    waitAbortRef.current?.abort()
    waitAbortRef.current = null
    try { popupRef.current?.close?.() } catch { /* popup is already cross-origin */ }
    popupRef.current = null
  }, [])

  const cancel = useCallback(() => {
    if (completionBusyRef.current) return
    cleanupWait()
    onClose()
  }, [cleanupWait, onClose])
  const dialogRef = useDialog(cancel, pending === 'complete', firstProviderRef)

  useEffect(() => () => {
    cleanupWait()
    completionAbortRef.current?.abort()
  }, [cleanupWait])

  const complete = async payload => {
    if (completionBusyRef.current) return
    completionBusyRef.current = true
    setPending('complete')
    setError('')
    const controller = new AbortController()
    completionAbortRef.current = controller
    try {
      const linked = await identityRequest(token, '/link/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      setCompletion(null)
      onSignedIn(linked)
    } catch (requestError) {
      if (controller.signal.aborted) return

      // A lost response is ambiguous: the remote exchange and local commit may
      // already have succeeded. Read the authoritative state before offering a
      // retry so success never looks like failure and replay stays idempotent.
      let current = null
      try {
        current = await identityRequest(token)
      } catch { /* keep the original completion error */ }
      if (current?.account_mode === 'linked' && !current.account_unavailable) {
        setCompletion(null)
        onSignedIn(current)
        return
      }

      const retryable = requestError instanceof IdentityRequestError
        && (requestError.status === 0 || requestError.status >= 500)
      setCompletion(retryable ? payload : null)
      setError(retryable
        ? 'Your account approved the link, but this Möbius could not confirm completion. The approval is kept only in this dialog—retry completion.'
        : requestError.message)
    } finally {
      if (completionAbortRef.current === controller) completionAbortRef.current = null
      completionBusyRef.current = false
      setPending('')
    }
  }

  const begin = async provider => {
    if (pending || startBusyRef.current) return
    startBusyRef.current = true
    setPending(provider)
    setError('')
    setCompletion(null)
    const popup = window.open(
      'about:blank',
      'mobius-account-signin',
      'width=520,height=720',
    )
    if (!popup) {
      startBusyRef.current = false
      setPending('')
      setError(
        'Your browser blocked the sign-in window. Allow popups for this Möbius, then retry.',
      )
      return
    }

    popupRef.current = popup
    const controller = new AbortController()
    waitAbortRef.current = controller
    let completing = false
    try {
      const attempt = await identityRequest(token, '/link/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
        signal: controller.signal,
      })
      const result = await waitForAccountLink({
        popup,
        attempt,
        signal: controller.signal,
      })
      waitAbortRef.current = null
      popupRef.current = null
      const payload = {
        code: result.code,
        state: result.state,
        attempt: attempt.attempt,
      }
      setCompletion(payload)
      completing = true
      await complete(payload)
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(requestError.message || 'Sign-in could not start.')
      }
      cleanupWait()
    } finally {
      if (waitAbortRef.current === controller) waitAbortRef.current = null
      startBusyRef.current = false
      if (!completing) setPending('')
    }
  }

  const providerLabel = pending === 'google'
    ? 'Waiting for Google…'
    : pending === 'apple'
      ? 'Waiting for Apple…'
      : pending === 'complete'
        ? 'Finishing sign-in…'
        : ''

  return (
    <div
      className="id-modal-backdrop"
      onMouseDown={event => {
        if (pending !== 'complete' && event.target === event.currentTarget) cancel()
      }}
    >
      <section
        ref={dialogRef}
        className="id-modal id-signin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        aria-describedby="signin-description"
        aria-busy={pending === 'complete'}
        tabIndex={-1}
      >
        <div className="id-lock" aria-hidden="true">
          <Lock width={20} height={20} />
        </div>
        <h2 id="signin-title">Sign in to Möbius</h2>
        <p id="signin-description">
          Use the same account as mobius.you. You will return here automatically after consent.
        </p>
        <div className="id-provider-list">
          <button
            ref={firstProviderRef}
            type="button"
            className="id-provider"
            disabled={Boolean(pending)}
            onClick={() => begin('google')}
          >
            <GoogleMark />
            <span className="id-provider-copy">Continue with Google</span>
            <span className="id-provider-balance" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="id-provider"
            disabled={Boolean(pending)}
            onClick={() => begin('apple')}
          >
            <AppleMark />
            <span className="id-provider-copy">Continue with Apple</span>
            <span className="id-provider-balance" aria-hidden="true" />
          </button>
        </div>
        <div className="id-progress" role="status" aria-live="polite">
          {providerLabel}
        </div>
        {error && <div className="id-signin-error" role="alert">{error}</div>}
        {completion && (
          <button
            type="button"
            className="id-btn id-btn--primary id-retry-completion"
            disabled={Boolean(pending)}
            onClick={() => complete(completion)}
          >
            Retry completion
          </button>
        )}
        <button
          type="button"
          className="id-btn id-cancel-signin"
          disabled={pending === 'complete'}
          onClick={cancel}
        >
          {pending === 'complete' ? 'Finishing…' : 'Cancel'}
        </button>
      </section>
    </div>
  )
}

function DisconnectModal({ token, onClose, onDisconnected, reconnecting = false }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const keepRef = useRef(null)
  const dialogRef = useDialog(onClose, pending, keepRef)

  const disconnect = async () => {
    if (pending) return
    setPending(true)
    setError('')
    try {
      await identityRequest(token, '/link', { method: 'DELETE' })
      onDisconnected()
    } catch (requestError) {
      setError(requestError.status === 502
        ? 'Möbius could not confirm revocation, so your existing link was kept. Nothing was disconnected; try again later.'
        : requestError.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      className="id-modal-backdrop"
      onMouseDown={event => {
        if (!pending && event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="id-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="disconnect-title"
        aria-describedby="disconnect-description"
        aria-busy={pending}
        tabIndex={-1}
      >
        <h2 id="disconnect-title">
          {reconnecting ? 'Reconnect this Möbius?' : 'Disconnect this Möbius?'}
        </h2>
        <p id="disconnect-description">
          {reconnecting
            ? 'Your account and deployments stay intact. The current link will be replaced so you can approve Railway management.'
            : 'Your mobius.you account and managed deployments stay intact. This self-hosted Möbius will stop showing or editing that account.'}
        </p>
        {error && <div className="id-signin-error" role="alert">{error}</div>}
        <div className="id-modal-actions">
          <button
            ref={keepRef}
            type="button"
            className="id-btn"
            disabled={pending}
            onClick={onClose}
          >
            Keep connected
          </button>
          <button
            type="button"
            className="id-btn id-btn--danger"
            disabled={pending}
            onClick={disconnect}
          >
            {pending
              ? reconnecting ? 'Preparing…' : 'Disconnecting…'
              : reconnecting ? 'Disconnect and reconnect' : 'Disconnect'}
          </button>
        </div>
      </section>
    </div>
  )
}

function Deployments({
  items,
  railway,
  onRefresh,
  refreshing,
  onNew,
  onManage,
  onConnect,
  onReconnect,
  onManageConnection,
}) {
  const managedById = new Map((railway?.instances || []).map(item => [item.id, item]))
  const deployments = [...items]
  for (const instance of railway?.instances || []) {
    if (!deployments.some(item => item.id === instance.id)) {
      deployments.push({
        id: instance.id,
        name: instance.name,
        status: instance.status,
        url: instance.url,
        current: false,
      })
    }
  }
  const connected = railway?.railway_access === 'available'
    && railway.connection?.connected

  return (
    <article className="id-card">
      <div className="id-card-head">
        <div>
          <h2>Active deployments</h2>
          <div className="id-card-sub">
            This Möbius is always listed, even without account access
          </div>
        </div>
        <div className="id-card-actions">
          {connected && (
            <button type="button" className="id-btn id-btn--small" onClick={onNew}>
              <Plus width={16} />
              New deployment
            </button>
          )}
          <button
            type="button"
            className="id-copy"
            disabled={refreshing}
            aria-label={refreshing ? 'Refreshing deployments' : 'Refresh deployments'}
            onClick={onRefresh}
          >
            <ArrowRotateCw className={refreshing ? 'id-spin' : ''} width={17} />
          </button>
        </div>
      </div>
      {railway?.railway_access === 'reconnect' && (
        <div className="id-railway-callout">
          <div>
            <strong>Approve Railway controls</strong>
            <span>Reconnect once to add the new deployment-management permission.</span>
          </div>
          <button type="button" className="id-btn" onClick={onReconnect}>Reconnect</button>
        </div>
      )}
      {railway?.railway_access === 'available' && !connected && (
        <div className="id-railway-callout">
          <div>
            <strong>{railway.connection ? 'Reconnect Railway' : 'Connect Railway'}</strong>
            <span>{railway.connection
              ? 'Railway authorization needs attention before this account can manage deployments.'
              : 'Connect your Railway account to create and manage Möbius deployments here.'}</span>
          </div>
          <button type="button" className="id-btn id-btn--primary" onClick={onConnect}>
            {railway.connection ? 'Reconnect Railway' : 'Connect Railway'}
          </button>
        </div>
      )}
      {railway?.railway_access === 'unavailable' && (
        <div className="id-railway-callout">
          <div>
            <strong>Railway controls are temporarily unavailable</strong>
            <span>Your confirmed deployment links remain below.</span>
          </div>
        </div>
      )}
      {connected && railway.connection && (
        <div className="id-railway-connection">
          <span className="id-railway-conn-account">
            Railway · {railway.connection.workspace || railway.connection.account || 'Connected'}
          </span>
          {planTitle(railway.connection.plan) && (
            <span className="id-railway-plan">{planTitle(railway.connection.plan)} plan</span>
          )}
          {onManageConnection && (
            <button type="button" className="id-railway-manage" onClick={onManageConnection}>
              Manage
            </button>
          )}
        </div>
      )}
      {connected && railway.connection?.deploy_blocked && (
        <div className="id-railway-callout id-railway-callout--warn">
          <div>
            <strong>Railway needs attention</strong>
            <span>{railway.connection.deploy_blocked}</span>
          </div>
        </div>
      )}
      <div className="id-deployments">
        {deployments.map(item => {
          const managed = managedById.get(item.id)
          return (
          <div className="id-deployment" key={item.id}>
            <div className="id-deploy-mark">
              <img src="/moebius.png" alt="" />
            </div>
            <div>
              <div className="id-deploy-name">{item.name}</div>
              <div className="id-deploy-meta">
                {managed?.current_step || item.status}
                {item.region ? ` · ${item.region}` : ''}
                {item.current ? ' · This deployment' : ''}
              </div>
            </div>
            <div className="id-deploy-actions">
              {managed && (
                <button
                  type="button"
                  className="id-open"
                  aria-label={`Manage ${item.name}`}
                  onClick={() => onManage(managed)}
                >
                  <SettingsCog width={18} />
                </button>
              )}
              {item.url && (
                <button
                  type="button"
                  className="id-open"
                  aria-label={`Open ${item.name} in a new tab`}
                  onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                >
                  <ArrowUpRight width={18} />
                </button>
              )}
            </div>
          </div>
          )
        })}
      </div>
    </article>
  )
}

function fmtCpu(n) {
  return `${n} vCPU`
}

function fmtMemory(mb) {
  return mb % 1024 === 0 ? `${mb / 1024} GB` : `${mb} MB`
}

function fmtVolume(mb) {
  return mb < 1000 ? `${mb} MB` : `${mb / 1000} GB`
}

function planTitle(label) {
  if (!label || label === 'unknown') return ''
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// Plan-bounded CPU / RAM / (optional) storage pickers, mirroring the resource
// choices the mobius.you website offers. `limits` is connection.plan_limits from
// the account host; when it is absent the component renders nothing so the modal
// gracefully falls back to plan defaults. Storage is rendered only when onVolume
// is supplied; storageMinMb enforces Railway's grow-only rule in the manage flow.
function ResourceFields({
  limits, cpu, memory, volume, onCpu, onMemory, onVolume, disabled, storageMinMb = 0,
}) {
  if (!limits) return null
  const cpuChoices = limits.cpu_choices.filter(value => value < limits.max_cpu)
  const memChoices = limits.memory_options_mb.filter(value => value < limits.max_memory_mb)
  const volChoices = limits.volume_options_mb.filter(value => value >= storageMinMb)
  return (
    <div className="id-resource-fields">
      <label className="id-field-block">
        <span className="id-label">CPU</span>
        <select className="id-select" value={cpu} disabled={disabled} onChange={event => onCpu(event.target.value)}>
          <option value="">Plan maximum · {fmtCpu(limits.max_cpu)}</option>
          {cpuChoices.map(value => <option key={value} value={value}>{fmtCpu(value)}</option>)}
        </select>
      </label>
      <label className="id-field-block">
        <span className="id-label">RAM</span>
        <select className="id-select" value={memory} disabled={disabled} onChange={event => onMemory(event.target.value)}>
          <option value="">Plan maximum · {fmtMemory(limits.max_memory_mb)}</option>
          {memChoices.map(value => <option key={value} value={value}>{fmtMemory(value)}</option>)}
        </select>
      </label>
      {onVolume && (
        <label className="id-field-block">
          <span className="id-label">Storage</span>
          <select className="id-select" value={volume} disabled={disabled} onChange={event => onVolume(event.target.value)}>
            {volChoices.map(value => <option key={value} value={value}>{fmtVolume(value)}</option>)}
          </select>
          {storageMinMb > 0 && <small>Railway volumes can only grow.</small>}
        </label>
      )}
    </div>
  )
}

function NewDeploymentModal({ onClose, onCreate, planLimits }) {
  const [name, setName] = useState('My Möbius')
  const [managedAuth, setManagedAuth] = useState(true)
  const [cpu, setCpu] = useState('')
  const [memory, setMemory] = useState('')
  const [volume, setVolume] = useState(planLimits ? String(planLimits.default_volume_mb) : '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const dialogRef = useDialog(onClose, pending, inputRef)

  const submit = async event => {
    event.preventDefault()
    if (!name.trim() || pending) return
    setPending(true)
    setError('')
    try {
      await onCreate({
        name: name.trim(),
        managed_auth: managedAuth,
        cpu: cpu ? Number(cpu) : null,
        memory_mb: memory ? Number(memory) : null,
        volume_mb: volume ? Number(volume) : null,
      })
      onClose()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="id-modal-backdrop" onMouseDown={event => {
      if (!pending && event.target === event.currentTarget) onClose()
    }}>
      <form
        ref={dialogRef}
        className="id-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-deployment-title"
        aria-busy={pending}
        tabIndex={-1}
        onSubmit={submit}
      >
        <h2 id="new-deployment-title">New Railway deployment</h2>
        <p>{planLimits
          ? 'Choose resources for this Möbius, or keep your plan’s defaults.'
          : 'Möbius will create a private Railway project using your plan defaults.'}</p>
        <label className="id-label" htmlFor="deployment-name">Deployment name</label>
        <div className="id-input-wrap">
          <input
            ref={inputRef}
            id="deployment-name"
            className="id-input"
            value={name}
            maxLength={80}
            disabled={pending}
            onChange={event => setName(event.target.value)}
          />
        </div>
        <ResourceFields
          limits={planLimits}
          cpu={cpu}
          memory={memory}
          volume={volume}
          onCpu={setCpu}
          onMemory={setMemory}
          onVolume={setVolume}
          disabled={pending}
        />
        <label className="id-check-row">
          <input
            type="checkbox"
            checked={managedAuth}
            disabled={pending}
            onChange={event => setManagedAuth(event.target.checked)}
          />
          <span>
            <strong>Use this Möbius account to sign in</strong>
            <small>Turn this off to create a deployment with local username/password setup.</small>
          </span>
        </label>
        {error && <div className="id-signin-error" role="alert">{error}</div>}
        <div className="id-modal-actions">
          <button type="button" className="id-btn" disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="id-btn id-btn--primary" disabled={!name.trim() || pending}>
            {pending ? 'Creating…' : 'Create deployment'}
          </button>
        </div>
      </form>
    </div>
  )
}

function meterPercent(value) {
  const parsed = parseFloat(String(value ?? '').replace('%', ''))
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0
}

function MetricMeter({ label, value, limit, percent }) {
  const pct = meterPercent(percent)
  return (
    <div className="id-meter">
      <div className="id-meter-head">
        <span className="id-meter-label">{label}</span>
        <span className="id-meter-value">
          {value || '—'}{limit ? <span className="id-meter-limit"> / {limit}</span> : null}
        </span>
      </div>
      <div className="id-meter-track">
        <div className="id-meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function DeploymentMetrics({ token, instance }) {
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (instance.status !== 'ready') return undefined
    const controller = new AbortController()
    setMetrics(null)
    setError('')
    ;(async () => {
      try {
        const data = await identityRequest(
          token, `/railway/deployments/${instance.id}/metrics`, { signal: controller.signal },
        )
        if (!controller.signal.aborted) setMetrics(data)
      } catch (requestError) {
        if (!controller.signal.aborted) setError(requestError.message)
      }
    })()
    return () => controller.abort()
  }, [instance.id, instance.status, token])

  if (instance.status !== 'ready') return null
  if (error) return <div className="id-metrics-note">Live metrics are unavailable right now.</div>
  if (!metrics) {
    return (
      <div className="id-metrics-note" role="status">
        <ArrowRotateCw className="id-spin" width={14} aria-hidden="true" /> Loading live metrics…
      </div>
    )
  }
  const runtime = metrics.runtime || {}
  const runtimeBits = [runtime.status_label, runtime.region_label, runtime.data_status].filter(Boolean)
  return (
    <div className="id-metrics">
      {runtimeBits.length > 0 && (
        <div className="id-metrics-runtime">{runtimeBits.join(' · ')}</div>
      )}
      <div className="id-meters">
        <MetricMeter label="CPU" value={metrics.cpu?.label} limit={metrics.cpu?.limit_label} percent={metrics.cpu?.percent} />
        <MetricMeter label="RAM" value={metrics.memory?.label} limit={metrics.memory?.limit_label} percent={metrics.memory?.percent} />
        <MetricMeter label="Storage" value={metrics.volume?.used_label} limit={metrics.volume?.allocated_label} percent={metrics.volume?.percent} />
        <MetricMeter
          label="Network"
          value={metrics.network?.rx_label || metrics.network?.tx_label
            ? `↓ ${metrics.network?.rx_label || '0'} · ↑ ${metrics.network?.tx_label || '0'}`
            : ''}
          percent={metrics.network?.percent}
        />
      </div>
    </div>
  )
}

function RecoverySection({ token, instance }) {
  // "Open Recovery" starts an ephemeral Railway worker on the account host and,
  // when it reports ready, hands off to the worker's own web UI in a popup — the
  // same web flow the mobius.you website uses. No credentials touch this frame.
  const [recovery, setRecovery] = useState(null)
  const pollRef = useRef(null)
  const busyRef = useRef(false)

  useEffect(() => () => {
    clearTimeout(pollRef.current)
    busyRef.current = false
  }, [])

  const poll = useCallback(async () => {
    try {
      const status = await identityRequest(token, `/railway/deployments/${instance.id}/recovery/status`)
      setRecovery({ state: status.state, message: status.message, error: status.error })
      if (status.state === 'ready' && status.open_url) {
        window.open(status.open_url, 'mobius-recovery', 'width=940,height=760')
        busyRef.current = false
        return
      }
      if (status.state === 'starting') {
        pollRef.current = setTimeout(poll, 2500)
      } else {
        busyRef.current = false
      }
    } catch (requestError) {
      busyRef.current = false
      setRecovery({ state: 'error', message: requestError.message, error: '' })
    }
  }, [token, instance.id])

  const start = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setRecovery({ state: 'starting', message: 'Starting a temporary recovery worker\u2026', error: '' })
    try {
      await identityRequest(token, `/railway/deployments/${instance.id}/recovery`, { method: 'POST' })
      poll()
    } catch (requestError) {
      busyRef.current = false
      setRecovery({ state: 'error', message: requestError.message, error: '' })
    }
  }

  if (!['ready', 'error'].includes(instance.status)) return null
  const preparing = recovery?.state === 'starting'
  return (
    <div className="id-recovery">
      <button type="button" className="id-btn id-recovery-btn" disabled={preparing} onClick={start}>
        {preparing
          ? <><ArrowRotateCw className="id-spin" width={16} /> Preparing Recovery…</>
          : 'Open Recovery'}
      </button>
      {recovery && recovery.state !== 'starting' && (
        <div
          className={`id-recovery-note${recovery.state === 'error' ? ' is-error' : ''}`}
          role="status"
        >
          {recovery.state === 'ready'
            ? 'Recovery opened in a new window.'
            : (recovery.error || recovery.message)}
        </div>
      )}
      {!recovery && (
        <small className="id-recovery-hint">
          Opens a temporary, isolated worker to inspect and repair this deployment.
        </small>
      )}
    </div>
  )
}

function ManageDeploymentModal({ instance, onClose, onCompute, onStorage, onRetry, onDelete, planLimits, token }) {
  // Selects use '' to mean "plan maximum"; if the deployment already sits at the
  // plan ceiling, start there rather than on a value the picker would not list.
  const [cpu, setCpu] = useState(() => {
    const current = instance.resources.cpu ? String(instance.resources.cpu) : ''
    return planLimits && Number(current) >= planLimits.max_cpu ? '' : current
  })
  const [memory, setMemory] = useState(() => {
    const current = instance.resources.memory_mb ? String(instance.resources.memory_mb) : ''
    return planLimits && Number(current) >= planLimits.max_memory_mb ? '' : current
  })
  const [volume, setVolume] = useState(
    instance.resources.volume_size_mb ? String(instance.resources.volume_size_mb) : '',
  )
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const closeRef = useRef(null)
  const dialogRef = useDialog(onClose, Boolean(pending), closeRef)

  const run = async (action, work) => {
    if (pending) return
    setPending(action)
    setError('')
    try {
      await work()
      onClose()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPending('')
    }
  }

  return (
    <div className="id-modal-backdrop" onMouseDown={event => {
      if (!pending && event.target === event.currentTarget) onClose()
    }}>
      <section
        ref={dialogRef}
        className="id-modal id-manage-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-deployment-title"
        aria-busy={Boolean(pending)}
        tabIndex={-1}
      >
        <div className="id-manage-head">
          <div>
            <h2 id="manage-deployment-title">{instance.name}</h2>
            <p>{instance.current_step || instance.status}</p>
          </div>
          <span className="id-plan">{instance.resources.plan}</span>
        </div>

        <DeploymentMetrics token={token} instance={instance} />

        {instance.actions.edit_resources && (
          <div className="id-manage-resources">
            {planLimits ? (
              <ResourceFields
                limits={planLimits}
                cpu={cpu}
                memory={memory}
                onCpu={setCpu}
                onMemory={setMemory}
                disabled={Boolean(pending)}
              />
            ) : (
              <div className="id-resource-fields">
                <label className="id-field-block">
                  <span className="id-label">CPU</span>
                  <input
                    className="id-input id-input--boxed"
                    inputMode="numeric"
                    value={cpu}
                    placeholder="Plan maximum"
                    disabled={Boolean(pending)}
                    onChange={event => setCpu(event.target.value.replace(/\D/g, ''))}
                  />
                </label>
                <label className="id-field-block">
                  <span className="id-label">RAM (MB)</span>
                  <input
                    className="id-input id-input--boxed"
                    inputMode="numeric"
                    value={memory}
                    placeholder="Plan maximum"
                    disabled={Boolean(pending)}
                    onChange={event => setMemory(event.target.value.replace(/\D/g, ''))}
                  />
                </label>
              </div>
            )}
            <button
              type="button"
              className="id-btn id-resource-save"
              disabled={Boolean(pending)}
              onClick={() => run('compute', () => onCompute(instance.id, {
                cpu: cpu ? Number(cpu) : null,
                memory_mb: memory ? Number(memory) : null,
              }))}
            >
              {pending === 'compute' ? 'Updating…' : 'Update resources'}
            </button>
            {instance.resources.volume_size_mb ? (
              <div className="id-storage-row">
                <label className="id-field-block">
                  <span className="id-label">Storage</span>
                  {planLimits ? (
                    <select
                      className="id-select"
                      value={volume}
                      disabled={Boolean(pending)}
                      onChange={event => setVolume(event.target.value)}
                    >
                      {planLimits.volume_options_mb
                        .filter(value => value >= instance.resources.volume_size_mb)
                        .map(value => <option key={value} value={value}>{fmtVolume(value)}</option>)}
                    </select>
                  ) : (
                    <input
                      className="id-input id-input--boxed"
                      inputMode="numeric"
                      value={volume}
                      disabled={Boolean(pending)}
                      onChange={event => setVolume(event.target.value.replace(/\D/g, ''))}
                    />
                  )}
                  <small>Railway volumes can only grow.</small>
                </label>
                <button
                  type="button"
                  className="id-btn id-resource-save"
                  disabled={Boolean(pending) || !volume
                    || (Boolean(planLimits) && Number(volume) <= instance.resources.volume_size_mb)}
                  onClick={() => run('storage', () => onStorage(instance.id, {
                    volume_mb: Number(volume),
                  }))}
                >
                  {pending === 'storage' ? 'Growing…' : 'Grow storage'}
                </button>
              </div>
            ) : null}
          </div>
        )}

        {instance.last_error && <div className="id-manage-error">{instance.last_error}</div>}
        {error && <div className="id-signin-error" role="alert">{error}</div>}

        <div className="id-manage-links">
          {instance.url && (
            <button type="button" className="id-btn" onClick={() => window.open(instance.url, '_blank', 'noopener,noreferrer')}>
              Open Möbius <ArrowUpRight width={16} />
            </button>
          )}
          {instance.railway_url && (
            <button type="button" className="id-btn" onClick={() => window.open(instance.railway_url, '_blank', 'noopener,noreferrer')}>
              Open Railway <ArrowUpRight width={16} />
            </button>
          )}
          {instance.actions.retry && (
            <button type="button" className="id-btn" disabled={Boolean(pending)} onClick={() => run('retry', () => onRetry(instance.id))}>
              {pending === 'retry' ? 'Retrying…' : 'Retry deployment'}
            </button>
          )}
        </div>

        <RecoverySection token={token} instance={instance} />

        {instance.actions.delete && (
          confirmDelete ? (
            <div className="id-delete-confirm">
              <strong>Delete this Möbius and its Railway project?</strong>
              <span>This permanently removes the deployment and cannot be undone.</span>
              <div>
                <button type="button" className="id-btn" disabled={Boolean(pending)} onClick={() => setConfirmDelete(false)}>
                  Keep deployment
                </button>
                <button type="button" className="id-btn id-btn--danger" disabled={Boolean(pending)} onClick={() => run('delete', () => onDelete(instance.id))}>
                  {pending === 'delete' ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="id-btn id-btn--quiet id-delete-trigger" onClick={() => setConfirmDelete(true)}>
              <Trash width={16} /> Delete deployment
            </button>
          )
        )}

        <button ref={closeRef} type="button" className="id-btn id-modal-close" disabled={Boolean(pending)} onClick={onClose}>
          Close
        </button>
      </section>
    </div>
  )
}

function RailwayConnectionModal({
  token, connection, onClose, onReload, onChangeAccount, onDisconnected,
}) {
  const [inventory, setInventory] = useState(null)
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const closeRef = useRef(null)
  const dialogRef = useDialog(onClose, Boolean(pending), closeRef)

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      try {
        const data = await identityRequest(token, '/railway/workspaces', { signal: controller.signal })
        setInventory(data)
      } catch { if (!controller.signal.aborted) setInventory({ workspaces: [], current: null }) }
    })()
    return () => controller.abort()
  }, [token])

  const run = async (action, work) => {
    if (pending) return
    setPending(action)
    setError('')
    try {
      await work()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPending('')
    }
  }

  const workspaces = inventory?.workspaces || []
  const currentWorkspace = inventory?.current || ''

  return (
    <div className="id-modal-backdrop" onMouseDown={event => {
      if (!pending && event.target === event.currentTarget) onClose()
    }}>
      <section
        ref={dialogRef}
        className="id-modal id-manage-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="railway-connection-title"
        aria-busy={Boolean(pending)}
        tabIndex={-1}
      >
        <div className="id-manage-head">
          <div>
            <h2 id="railway-connection-title">Railway connection</h2>
            <p>{connection.account || 'Connected to Railway'}</p>
          </div>
          {connection.plan && connection.plan !== 'unknown' && (
            <span className="id-plan">{connection.plan}</span>
          )}
        </div>

        <div className="id-manage-resources">
          {workspaces.length > 1 && (
            <label className="id-field-block">
              <span className="id-label">Workspace</span>
              <select
                className="id-select"
                value={currentWorkspace}
                disabled={Boolean(pending)}
                onChange={event => {
                  const nextId = event.target.value
                  run('workspace', async () => {
                    await identityRequest(token, '/railway/workspace', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ workspace_id: nextId }),
                    })
                    // Keep the picker in sync with the switch: loadRailway refreshes
                    // /railway (the header) but not this modal's workspace inventory.
                    setInventory(previous => (previous ? { ...previous, current: nextId } : previous))
                    await onReload()
                  })
                }}
              >
                {workspaces.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          )}
          {workspaces.length === 1 && (
            <div className="id-field-block">
              <span className="id-label">Workspace</span>
              <div className="id-value">{workspaces[0].name}</div>
            </div>
          )}
          <div className="id-storage-row">
            <div className="id-field-block">
              <span className="id-label">Plan</span>
              <div className="id-value">
                {connection.plan && connection.plan !== 'unknown'
                  ? connection.plan.charAt(0).toUpperCase() + connection.plan.slice(1)
                  : 'Not detected yet'}
              </div>
            </div>
            <button
              type="button"
              className="id-btn"
              disabled={Boolean(pending)}
              onClick={() => run('plan', async () => {
                await identityRequest(token, '/railway/plan/refresh', { method: 'POST' })
                await onReload()
              })}
            >
              {pending === 'plan' ? 'Refreshing…' : 'Refresh plan'}
            </button>
          </div>
        </div>

        {connection.deploy_blocked && (
          <div className="id-manage-error">{connection.deploy_blocked}</div>
        )}
        {error && <div className="id-signin-error" role="alert">{error}</div>}

        <div className="id-manage-links">
          <button
            type="button"
            className="id-btn"
            disabled={Boolean(pending)}
            onClick={() => { onClose(); onChangeAccount() }}
          >
            Change Railway account
          </button>
        </div>

        {confirmDisconnect ? (
          <div className="id-delete-confirm">
            <strong>Disconnect Railway from Möbius?</strong>
            <span>New deployments will need a Railway account again. Existing deployments are unaffected.</span>
            <div>
              <button type="button" className="id-btn" disabled={Boolean(pending)} onClick={() => setConfirmDisconnect(false)}>
                Keep connected
              </button>
              <button
                type="button"
                className="id-btn id-btn--danger"
                disabled={Boolean(pending)}
                onClick={() => run('disconnect', async () => {
                  await identityRequest(token, '/railway/disconnect', { method: 'POST' })
                  onDisconnected()
                })}
              >
                {pending === 'disconnect' ? 'Disconnecting…' : 'Disconnect Railway'}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="id-btn id-btn--quiet id-delete-trigger" onClick={() => setConfirmDisconnect(true)}>
            <Trash width={16} /> Disconnect Railway
          </button>
        )}

        <button ref={closeRef} type="button" className="id-btn id-modal-close" disabled={Boolean(pending)} onClick={onClose}>
          Close
        </button>
      </section>
    </div>
  )
}

export default function App({ appId, token }) {
  const [data, setData] = useState(null)
  const [railway, setRailway] = useState(null)
  const [railwayLoading, setRailwayLoading] = useState(false)
  const [railwayError, setRailwayError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [editing, setEditing] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [creatingDeployment, setCreatingDeployment] = useState(false)
  const [managingDeployment, setManagingDeployment] = useState(null)
  const [managingRailway, setManagingRailway] = useState(false)
  const [connectingRailway, setConnectingRailway] = useState(false)
  const [copied, setCopied] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const copyTimerRef = useRef(null)
  const loadSequenceRef = useRef(0)
  const railwaySequenceRef = useRef(0)
  const railwayConnectAbortRef = useRef(null)

  const load = useCallback(async () => {
    const sequence = ++loadSequenceRef.current
    setLoading(true)
    setLoadError('')
    try {
      const next = await identityRequest(token)
      if (loadSequenceRef.current === sequence) setData(next)
    } catch (requestError) {
      if (loadSequenceRef.current === sequence) setLoadError(requestError.message)
    } finally {
      if (loadSequenceRef.current === sequence) setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
    return () => { loadSequenceRef.current += 1 }
  }, [load])

  const loadRailway = useCallback(async ({ quiet = false } = {}) => {
    const sequence = ++railwaySequenceRef.current
    if (!quiet) setRailwayLoading(true)
    setRailwayError('')
    try {
      const next = await identityRequest(token, '/railway')
      if (railwaySequenceRef.current === sequence) setRailway(next)
      return next
    } catch (requestError) {
      if (railwaySequenceRef.current === sequence) setRailwayError(requestError.message)
      return null
    } finally {
      if (!quiet && railwaySequenceRef.current === sequence) setRailwayLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (data?.account_mode === 'linked' || data?.account_mode === 'managed') {
      void loadRailway()
    } else {
      setRailway(null)
    }
    return () => { railwaySequenceRef.current += 1 }
  }, [data?.account_mode, loadRailway])

  useEffect(() => () => {
    clearTimeout(copyTimerRef.current)
    railwayConnectAbortRef.current?.abort()
  }, [])

  if (!data && loading) {
    return (
      <>
        <style>{IDENTITY_STYLES}</style>
        <main className="id-root" aria-busy="true">
          <div className="id-loading" role="status" aria-label="Loading identity">
            <ArrowRotateCw className="id-spin" width={24} aria-hidden="true" />
          </div>
        </main>
      </>
    )
  }

  if (!data) {
    return (
      <>
        <style>{IDENTITY_STYLES}</style>
        <main className="id-root">
          <div className="id-shell">
            <Brand appId={appId} status={accountStatus(null)} />
            <section className="id-card id-fatal" role="alert">
              <h1>We couldn’t check your account.</h1>
              <p>{loadError}</p>
              <button type="button" className="id-btn" disabled={loading} onClick={load}>
                {loading ? 'Trying again…' : 'Try again'}
              </button>
            </section>
          </div>
        </main>
      </>
    )
  }

  const mode = data.account_mode
  const unavailable = data.account_unavailable
  const profile = data.profile
  const canEdit = (mode === 'linked' || mode === 'managed')
    && !unavailable
    && Boolean(profile)
  const needsHandle = canEdit && !profile?.handle

  const saveHandle = async handle => {
    setActionError('')
    setData(await identityRequest(token, '/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle }),
    }))
  }

  const uploadAvatar = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !canEdit) return
    setUploading(true)
    setActionError('')
    try {
      const body = new FormData()
      body.append('avatar', file)
      setData(await identityRequest(token, '/avatar', { method: 'POST', body }))
    } catch (requestError) {
      setActionError(requestError.message)
    } finally {
      setUploading(false)
    }
  }

  const copyId = async () => {
    if (!profile?.user_id) return
    setActionError('')
    try {
      await navigator.clipboard.writeText(profile.user_id)
      setCopied(true)
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 1400)
    } catch {
      setActionError('Couldn’t copy the user ID. Select it manually and try again.')
    }
  }

  const railwayAction = async (path, options = {}) => {
    const result = await identityRequest(token, `/railway${path}`, options)
    await loadRailway()
    return result
  }

  const connectRailway = async (replace = false) => {
    if (connectingRailway) return
    setConnectingRailway(true)
    setRailwayError('')
    const popup = window.open('about:blank', 'mobius-railway-connect', 'width=560,height=760')
    if (!popup) {
      setConnectingRailway(false)
      setRailwayError('Your browser blocked the Railway window. Allow popups, then try again.')
      return
    }
    const controller = new AbortController()
    railwayConnectAbortRef.current = controller
    try {
      const started = await identityRequest(token, '/railway/connect/start', {
        method: 'POST',
        signal: controller.signal,
        ...(replace
          ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ replace: true }),
          }
          : {}),
      })
      const authorization = new URL(started.authorization_url)
      if (authorization.protocol !== 'https:') throw new Error('Möbius returned an invalid Railway sign-in address.')
      popup.location.replace(authorization.href)
      const deadline = Date.now() + 10 * 60 * 1000
      while (!controller.signal.aborted && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 900))
        const next = await loadRailway({ quiet: true })
        if (next?.connection?.connected) {
          try { popup.close() } catch { /* already closed */ }
          return
        }
        if (popup.closed) {
          throw new Error('Railway connection was cancelled. Try again when you are ready.')
        }
      }
      throw new Error('Railway connection took too long. Please try again.')
    } catch (requestError) {
      if (!controller.signal.aborted) setRailwayError(requestError.message)
      try { popup.close() } catch { /* already closed */ }
    } finally {
      if (railwayConnectAbortRef.current === controller) railwayConnectAbortRef.current = null
      setConnectingRailway(false)
    }
  }

  return (
    <>
      <style>{IDENTITY_STYLES}</style>
      <main className="id-root">
        <div className="id-shell">
          <Brand appId={appId} status={accountStatus(data)} />

          {loadError && (
            <section className="id-notice id-notice--error" role="alert">
              <strong>We couldn’t refresh your account.</strong>
              <span>{loadError} The last confirmed details remain below.</span>
              <button type="button" className="id-btn" disabled={loading} onClick={load}>
                {loading ? 'Trying again…' : 'Try again'}
              </button>
            </section>
          )}

          {unavailable && (
            <section className="id-notice" role="status">
              <strong>
                Your {mode === 'managed' ? 'managed account' : 'linked account'} is temporarily unavailable.
              </strong>
              <span>
                This Möbius is still available. Account details and editing are paused until the connection recovers.
              </span>
            </section>
          )}


          {railwayError && (
            <section className="id-notice id-notice--error" role="alert">
              <strong>Railway controls need attention.</strong>
              <span>{railwayError}</span>
              <button type="button" className="id-btn" onClick={() => loadRailway()}>
                Try again
              </button>
            </section>
          )}

          {mode === 'signed_out' ? (
            <>
              <section className="id-auth">
                <h1>Your account stays yours.</h1>
                <p>
                  Sign in to see your profile and deployments. Until then, account details stay
                  hidden and this installation remains self-hosted.
                </p>
                <button
                  type="button"
                  className="id-btn id-btn--primary id-auth-button"
                  onClick={() => setSigningIn(true)}
                >
                  Sign in to Möbius
                </button>
              </section>
              <Deployments
                items={data.deployments}
                railway={railway}
                onRefresh={load}
                refreshing={loading}
              />
            </>
          ) : (
            <>
              <section className="id-hero">
                <div className={`id-avatar${!canEdit ? ' is-disabled' : ''}`}>
                  <ProfileAvatar profile={profile} token={token} />
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        className="id-avatar-edit"
                        disabled={uploading}
                        aria-label={uploading ? 'Uploading profile picture' : 'Change profile picture'}
                        onClick={() => fileRef.current?.click()}
                      >
                        {uploading
                          ? <ArrowRotateCw className="id-spin" width={16} />
                          : <Pencil width={16} />}
                      </button>
                      <input
                        ref={fileRef}
                        hidden
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={uploadAvatar}
                      />
                    </>
                  )}
                </div>
                <div className="id-profile-copy">
                  <div className="id-title-row">
                    <h1 className="id-title">
                      {profile?.handle
                        ? `@${profile.handle}`
                        : unavailable
                          ? 'Account unavailable'
                          : 'Choose your handle'}
                    </h1>
                    {canEdit && (
                      <button
                        type="button"
                        className="id-handle-btn"
                        aria-label="Change handle"
                        onClick={() => setEditing(true)}
                      >
                        <Pencil width={18} />
                      </button>
                    )}
                  </div>
                  <div className="id-identity-caption">
                    Your identity across Möbius
                  </div>
                  {profile?.email && (
                    <div className="id-email">
                      <Lock width={13} aria-hidden="true" />
                      <span>{profile.email}</span>
                      <span className="id-private-label">Private</span>
                    </div>
                  )}
                </div>
              </section>

              <section className="id-grid">
                <Deployments
                  items={data.deployments}
                  railway={railway}
                  onRefresh={() => {
                    void load()
                    void loadRailway()
                  }}
                  refreshing={loading || railwayLoading}
                  onNew={() => setCreatingDeployment(true)}
                  onManage={setManagingDeployment}
                  onConnect={() => connectRailway()}
                  onManageConnection={() => setManagingRailway(true)}
                  onReconnect={() => {
                    setReconnecting(true)
                    setDisconnecting(true)
                  }}
                />
                <aside className="id-card">
                  <div className="id-card-head">
                    <div>
                      <h2>Account details</h2>
                      <div className="id-card-sub">
                        {mode === 'managed'
                          ? 'Managed by this deployment'
                          : 'Linked to this self-hosted deployment'}
                      </div>
                    </div>
                  </div>
                  <div className="id-data">
                    <div className="id-field">
                      <div className="id-label">User ID</div>
                      <div className="id-value-row">
                        <div className="id-value">{profile?.user_id || 'Unavailable'}</div>
                        {profile?.user_id && (
                          <button
                            type="button"
                            className="id-copy"
                            aria-label={copied ? 'User ID copied' : 'Copy user ID'}
                            onClick={copyId}
                          >
                            {copied ? <Check width={17} /> : <Copy width={17} />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="id-field">
                      <div className="id-label">Account type</div>
                      <div className="id-value">
                        {mode === 'managed' ? 'Managed · mobius.you' : 'Linked · self-hosted'}
                      </div>
                    </div>
                    {mode === 'linked' && (
                      <button
                        type="button"
                        className="id-btn id-btn--quiet"
                        onClick={() => setDisconnecting(true)}
                      >
                        Disconnect account
                      </button>
                    )}
                  </div>
                </aside>
              </section>
            </>
          )}

          {actionError && <div className="id-error" role="alert">{actionError}</div>}
          <span className="id-sr-only" aria-live="polite">
            {copied ? 'User ID copied.' : ''}
          </span>
        </div>

        {signingIn && (
          <SignInModal
            token={token}
            onClose={() => setSigningIn(false)}
            onSignedIn={next => {
              setData(next)
              setLoadError('')
              setSigningIn(false)
              setReconnecting(false)
              void loadRailway()
            }}
          />
        )}
        {(editing || needsHandle) && canEdit && (
          <HandleModal
            current={profile?.handle}
            required={needsHandle}
            onClose={() => { if (!needsHandle) setEditing(false) }}
            onSave={saveHandle}
          />
        )}
        {disconnecting && mode === 'linked' && (
          <DisconnectModal
            token={token}
            reconnecting={reconnecting}
            onClose={() => setDisconnecting(false)}
            onDisconnected={() => {
              setDisconnecting(false)
              if (reconnecting) {
                void load()
                setSigningIn(true)
              } else {
                void load()
              }
            }}
          />
        )}
        {creatingDeployment && (
          <NewDeploymentModal
            planLimits={railway?.connection?.plan_limits}
            onClose={() => setCreatingDeployment(false)}
            onCreate={payload => railwayAction('/deployments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })}
          />
        )}
        {managingDeployment && (
          <ManageDeploymentModal
            instance={managingDeployment}
            token={token}
            planLimits={railway?.connection?.plan_limits}
            onClose={() => setManagingDeployment(null)}
            onCompute={(id, payload) => railwayAction(`/deployments/${id}/compute`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })}
            onStorage={(id, payload) => railwayAction(`/deployments/${id}/storage`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })}
            onRetry={id => railwayAction(`/deployments/${id}/retry`, { method: 'POST' })}
            onDelete={id => railwayAction(`/deployments/${id}`, { method: 'DELETE' })}
          />
        )}
        {managingRailway && railway?.connection && (
          <RailwayConnectionModal
            token={token}
            connection={railway.connection}
            onClose={() => setManagingRailway(false)}
            onReload={loadRailway}
            onChangeAccount={() => connectRailway(true)}
            onDisconnected={() => {
              setManagingRailway(false)
              void loadRailway()
            }}
          />
        )}
      </main>
    </>
  )
}
