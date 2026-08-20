export const ACCOUNT_MODES = Object.freeze(['signed_out', 'linked', 'managed'])
export const RAILWAY_ACCESS = Object.freeze([
  'signed_out',
  'reconnect',
  'unavailable',
  'available',
])

const ACCOUNT_LINK_WINDOW_MS = 10 * 60 * 1000
const BROKER_ACK_WINDOW_MS = 5 * 1000
const ACCOUNT_LINK_STATE = /^[A-Za-z0-9_-]{32,512}$/
const ACCOUNT_LINK_ATTEMPT = /^[A-Za-z0-9_-]{16,512}$/
const ACCOUNT_LINK_CODE = /^[A-Za-z0-9_-]{32,512}$/
const HANDLE = /^[a-z0-9_]{3,30}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class IdentityRequestError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'IdentityRequestError'
    this.status = status
  }
}

function exactKeys(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const allowed = new Set([...required, ...optional])
  const keys = Object.keys(value)
  return required.every(key => keys.includes(key))
    && keys.every(key => allowed.has(key))
}

function loopback(hostname) {
  const host = hostname.toLowerCase()
  return host === 'localhost'
    || host.endsWith('.localhost')
    || host === '[::1]'
    || /^127(?:\.\d{1,3}){3}$/.test(host)
}

function webUrl(value, { httpsOnly = false } = {}) {
  if (typeof value !== 'string' || value.length > 2048) return null
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return null
  }
  if (parsed.username || parsed.password) return null
  if (parsed.protocol === 'https:') return parsed
  if (!httpsOnly && parsed.protocol === 'http:' && loopback(parsed.hostname)) return parsed
  return null
}

function validProfile(profile, degraded = false) {
  const fields = ['user_id', 'email', 'display_name', 'handle', 'avatar_url']
  if (!exactKeys(profile, fields)) return false
  if (
    typeof profile.user_id !== 'string'
    || profile.user_id.length < 1
    || profile.user_id.length > 128
    || typeof profile.email !== 'string'
    || profile.email.length > 320
    || !EMAIL.test(profile.email)
  ) return false
  if (degraded) {
    return profile.display_name === null
      && profile.handle === null
      && profile.avatar_url === null
  }
  return typeof profile.display_name === 'string'
    && profile.display_name.length <= 80
    && (profile.handle === null || HANDLE.test(profile.handle))
    && (profile.avatar_url === null || Boolean(webUrl(profile.avatar_url, { httpsOnly: true })))
}

function validDeployment(deployment) {
  const required = ['id', 'name', 'status', 'url']
  if (!exactKeys(deployment, required, ['region', 'current'])) return false
  return typeof deployment.id === 'string'
    && deployment.id.length > 0
    && deployment.id.length <= 96
    && typeof deployment.name === 'string'
    && deployment.name.length > 0
    && deployment.name.length <= 128
    && typeof deployment.status === 'string'
    && deployment.status.length > 0
    && deployment.status.length <= 64
    && (deployment.region === undefined
      || deployment.region === null
      || (typeof deployment.region === 'string' && deployment.region.length <= 64))
    && (deployment.current === undefined || typeof deployment.current === 'boolean')
    && Boolean(webUrl(deployment.url))
}

export function parseIdentity(value) {
  const fields = [
    'account_mode',
    'account_unavailable',
    'instance_id',
    'profile',
    'deployments',
  ]
  if (
    !exactKeys(value, fields)
    || !ACCOUNT_MODES.includes(value.account_mode)
    || typeof value.account_unavailable !== 'boolean'
    || !Array.isArray(value.deployments)
    || value.deployments.length < 1
    || value.deployments.length > 100
    || !value.deployments.every(validDeployment)
    || !value.deployments.some(item => item.current === true)
  ) {
    throw new Error('Möbius returned an invalid identity response.')
  }

  if (value.account_mode === 'signed_out') {
    if (value.account_unavailable || value.instance_id !== null || value.profile !== null) {
      throw new Error('Möbius returned account details while signed out.')
    }
    return value
  }

  if (value.account_mode === 'linked') {
    const valid = value.instance_id === null
      && (value.account_unavailable
        ? value.profile === null
        : validProfile(value.profile))
    if (!valid) throw new Error('Möbius returned an invalid linked-account response.')
    return value
  }

  const validManaged = typeof value.instance_id === 'string'
    && value.instance_id.length > 0
    && (value.account_unavailable
      ? validProfile(value.profile, true)
      : validProfile(value.profile))
  if (!validManaged) {
    throw new Error('Möbius returned an invalid managed-account response.')
  }
  return value
}

function nullableString(value, max) {
  return value === null || (typeof value === 'string' && value.length <= max)
}

function validRailwayInstance(instance) {
  if (!exactKeys(instance, [
    'id', 'name', 'status', 'url', 'railway_url', 'current_step',
    'last_error', 'resources', 'actions',
  ])) return false
  if (
    typeof instance.id !== 'string'
    || !/^mob_[A-Za-z0-9_-]{3,80}$/.test(instance.id)
    || typeof instance.name !== 'string'
    || instance.name.length < 1
    || instance.name.length > 80
    || typeof instance.status !== 'string'
    || instance.status.length < 1
    || instance.status.length > 32
    || !nullableString(instance.current_step, 160)
    || !nullableString(instance.last_error, 360)
    || (instance.url !== null && !webUrl(instance.url))
  ) return false
  const railwayUrl = instance.railway_url === null
    ? null
    : webUrl(instance.railway_url, { httpsOnly: true })
  if (railwayUrl && railwayUrl.hostname !== 'railway.com') return false
  if (instance.railway_url !== null && !railwayUrl) return false
  const resources = instance.resources
  if (!exactKeys(resources, ['cpu', 'memory_mb', 'volume_size_mb', 'plan'])) return false
  if (
    !nullableString(resources.cpu, 16)
    || (resources.memory_mb !== null && !Number.isInteger(resources.memory_mb))
    || (resources.volume_size_mb !== null && !Number.isInteger(resources.volume_size_mb))
    || typeof resources.plan !== 'string'
    || resources.plan.length > 32
  ) return false
  const actions = instance.actions
  return exactKeys(actions, ['edit_resources', 'retry', 'delete'])
    && Object.values(actions).every(value => typeof value === 'boolean')
}

export function parseRailway(value) {
  if (
    !exactKeys(value, ['railway_access', 'connection', 'instances'])
    || !RAILWAY_ACCESS.includes(value.railway_access)
    || !Array.isArray(value.instances)
    || value.instances.length > 100
    || !value.instances.every(validRailwayInstance)
  ) throw new Error('Möbius returned invalid Railway deployment state.')

  if (value.railway_access !== 'available') {
    if (value.connection !== null || value.instances.length) {
      throw new Error('Möbius exposed Railway details without account access.')
    }
    return value
  }
  if (value.connection !== null) {
    const connection = value.connection
    if (
      !exactKeys(connection, [
        'connected', 'account', 'workspace', 'plan', 'deploy_blocked',
      ])
      || typeof connection.connected !== 'boolean'
      || typeof connection.account !== 'string'
      || connection.account.length > 320
      || typeof connection.workspace !== 'string'
      || connection.workspace.length > 128
      || typeof connection.plan !== 'string'
      || connection.plan.length > 32
      || typeof connection.deploy_blocked !== 'string'
      || connection.deploy_blocked.length > 360
    ) throw new Error('Möbius returned an invalid Railway connection.')
  }
  return value
}

export function parseLinkAttempt(value) {
  const fields = ['authorization_url', 'attempt', 'state', 'expires_at']
  if (
    !exactKeys(value, fields)
    || !ACCOUNT_LINK_ATTEMPT.test(value.attempt)
    || !ACCOUNT_LINK_STATE.test(value.state)
    || typeof value.expires_at !== 'string'
    || !Number.isFinite(Date.parse(value.expires_at))
  ) {
    throw new Error('Möbius returned an invalid sign-in attempt.')
  }
  const authorization = webUrl(value.authorization_url)
  if (
    !authorization
    || authorization.hash
    || authorization.searchParams.getAll('state').length !== 1
    || authorization.searchParams.get('state') !== value.state
  ) {
    throw new Error('Möbius returned an invalid sign-in address.')
  }
  return {
    ...value,
    authorization_origin: authorization.origin,
  }
}

export function accountStatus(identity) {
  if (!identity) return { label: 'Account unavailable', tone: 'error' }
  if (identity.account_unavailable) {
    return {
      label: identity.account_mode === 'managed'
        ? 'Managed account unavailable'
        : 'Linked account unavailable',
      tone: 'warning',
    }
  }
  if (identity.account_mode === 'managed') {
    return { label: 'Managed by mobius.you', tone: 'online' }
  }
  if (identity.account_mode === 'linked') {
    return { label: 'Linked to mobius.you', tone: 'online' }
  }
  return { label: 'Not signed in', tone: 'muted' }
}

function exactMessage(message, fields) {
  return exactKeys(message, fields)
}

export function waitForAccountLink({
  popup,
  attempt,
  signal,
  eventTarget = window,
  parentWindow = window.parent,
  shellOrigin = window.location.origin,
  now = Date.now,
  registrationTimeoutMs = BROKER_ACK_WINDOW_MS,
  closedPollMs = 350,
}) {
  const authorizationOrigin = attempt.authorization_origin
    || new URL(attempt.authorization_url).origin
  // The account service enforces the absolute expiry. Use a bounded local
  // window here so a skewed browser clock can neither reject a fresh attempt
  // immediately nor retain a broker registration indefinitely.
  const deadline = now() + ACCOUNT_LINK_WINDOW_MS

  return new Promise((resolve, reject) => {
    let settled = false
    let registered = false
    let closedTimer = null
    let expiryTimer = null
    let registrationTimer = null

    const unregister = () => {
      try {
        parentWindow.postMessage({
          type: 'moebius:account-link-unregister',
          state: attempt.state,
        }, shellOrigin)
      } catch { /* parent retired with this frame */ }
    }

    const closePopup = () => {
      try { popup?.close?.() } catch { /* cross-origin popup already gone */ }
    }

    const finish = (error, result) => {
      if (settled) return
      settled = true
      eventTarget.removeEventListener('message', receive)
      signal?.removeEventListener('abort', abort)
      clearInterval(closedTimer)
      clearTimeout(expiryTimer)
      clearTimeout(registrationTimer)
      unregister()
      closePopup()
      error ? reject(error) : resolve(result)
    }

    const receive = event => {
      if (event.source !== parentWindow || event.origin !== shellOrigin) return
      const message = event.data
      if (
        !registered
        && exactMessage(message, ['type', 'state'])
        && message.type === 'moebius:account-link-registered'
        && message.state === attempt.state
      ) {
        registered = true
        clearTimeout(registrationTimer)
        try {
          popup.location.replace(attempt.authorization_url)
        } catch {
          finish(new Error('The sign-in window could not be opened. Please try again.'))
        }
        return
      }
      if (
        !registered
        || !exactMessage(message, ['type', 'code', 'state', 'authorizationOrigin'])
        || message.type !== 'moebius:account-link-result'
        || message.authorizationOrigin !== authorizationOrigin
        || message.state !== attempt.state
        || typeof message.code !== 'string'
        || !ACCOUNT_LINK_CODE.test(message.code)
      ) return
      finish(null, { code: message.code, state: message.state })
    }

    const abort = () => finish(new Error('Sign-in cancelled.'))

    eventTarget.addEventListener('message', receive)
    signal?.addEventListener('abort', abort, { once: true })
    closedTimer = setInterval(() => {
      if (popup.closed) {
        finish(new Error('The sign-in window was closed. Try again when you are ready.'))
      }
    }, closedPollMs)
    expiryTimer = setTimeout(() => {
      finish(new Error('Sign-in took too long. Please try again.'))
    }, Math.max(0, deadline - now()))
    registrationTimer = setTimeout(() => {
      finish(new Error('Möbius could not prepare secure sign-in. Please try again.'))
    }, registrationTimeoutMs)

    if (signal?.aborted) {
      abort()
      return
    }
    try {
      parentWindow.postMessage({
        type: 'moebius:account-link-register',
        authorizationOrigin,
        state: attempt.state,
        expiresAt: attempt.expires_at,
      }, shellOrigin)
    } catch {
      finish(new Error('Möbius could not prepare secure sign-in. Please try again.'))
    }
  })
}
