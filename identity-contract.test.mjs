import test from 'node:test'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

import {
  accountStatus,
  deploymentNeedsTracking,
  deploymentPresentation,
  parseIdentity,
  parseDeletionDiagnosis,
  parseLinkAttempt,
  parseRailway,
  waitForAccountLink,
} from './identity-contract.js'

const localDeployment = {
  id: 'local',
  name: 'This Möbius',
  status: 'Active',
  url: 'https://mobius.example',
  current: true,
}

const profile = {
  user_id: 'usr_123',
  email: 'owner@example.com',
  display_name: 'Owner',
  handle: 'owner',
  avatar_url: null,
}

const baseIdentity = {
  account_mode: 'signed_out',
  account_unavailable: false,
  instance_id: null,
  profile: null,
  deployments: [localDeployment],
}

const linkAttempt = {
  authorization_url: `https://www.mobius.you/connect/mobius?state=${'s'.repeat(43)}`,
  authorization_origin: 'https://www.mobius.you',
  attempt: 'a'.repeat(32),
  state: 's'.repeat(43),
  expires_at: '2026-08-20T04:00:00Z',
}

class MessageTarget extends EventTarget {
  constructor() {
    super()
    this.listeners = 0
  }

  addEventListener(type, listener, options) {
    if (type === 'message') this.listeners += 1
    super.addEventListener(type, listener, options)
  }

  removeEventListener(type, listener, options) {
    if (type === 'message') this.listeners -= 1
    super.removeEventListener(type, listener, options)
  }
}

function emit(target, source, origin, data) {
  const event = new Event('message')
  Object.assign(event, { source, origin, data })
  target.dispatchEvent(event)
}

function brokerFixture(overrides = {}) {
  const target = new MessageTarget()
  const posts = []
  const parentWindow = {
    postMessage(message, origin) { posts.push({ message, origin }) },
  }
  const popup = {
    closed: false,
    navigated: null,
    close() { this.closed = true },
    location: { replace(url) { popup.navigated = url } },
  }
  const waiting = waitForAccountLink({
    popup,
    attempt: linkAttempt,
    eventTarget: target,
    parentWindow,
    shellOrigin: 'https://mobius.example',
    registrationTimeoutMs: 1000,
    ...overrides,
  })
  return { target, posts, parentWindow, popup, waiting }
}

test('accepts only the exact signed-out identity contract', () => {
  assert.equal(parseIdentity(baseIdentity), baseIdentity)
  assert.throws(() => parseIdentity({ ...baseIdentity, managed: false }))
  assert.throws(() => parseIdentity({ ...baseIdentity, account_unavailable: true }))
  assert.throws(() => parseIdentity({
    ...baseIdentity,
    deployments: [{ ...localDeployment, url: 'javascript:alert(1)' }],
  }))
})

test('enforces available and degraded profile boundaries', () => {
  assert.doesNotThrow(() => parseIdentity({
    ...baseIdentity,
    account_mode: 'linked',
    profile,
  }))
  assert.doesNotThrow(() => parseIdentity({
    ...baseIdentity,
    account_mode: 'linked',
    account_unavailable: true,
  }))
  assert.doesNotThrow(() => parseIdentity({
    ...baseIdentity,
    account_mode: 'managed',
    account_unavailable: true,
    instance_id: 'mob_123',
    profile: {
      ...profile,
      display_name: null,
      handle: null,
      avatar_url: null,
    },
  }))
  assert.throws(() => parseIdentity({
    ...baseIdentity,
    account_mode: 'linked',
    account_unavailable: true,
    profile,
  }))
  assert.throws(() => parseIdentity({
    ...baseIdentity,
    account_mode: 'managed',
    instance_id: 'mob_123',
  }))
})

test('never labels missing data as connected', () => {
  assert.deepEqual(accountStatus(null), {
    label: 'Account unavailable',
    tone: 'error',
  })
  assert.equal(accountStatus({
    account_mode: 'linked',
    account_unavailable: true,
  }).tone, 'warning')
})

test('parses only a state-bound secure account-link attempt', () => {
  const wireAttempt = { ...linkAttempt }
  delete wireAttempt.authorization_origin
  assert.deepEqual(parseLinkAttempt(wireAttempt), linkAttempt)
  assert.throws(() => parseLinkAttempt({ ...wireAttempt, extra: true }))
  assert.throws(() => parseLinkAttempt({
    ...wireAttempt,
    authorization_url: 'http://account.example/connect/mobius?state=' + linkAttempt.state,
  }))
  assert.throws(() => parseLinkAttempt({
    ...wireAttempt,
    authorization_url: 'https://www.mobius.you/connect/mobius?state=wrong',
  }))
})

test('accepts bounded Railway management state and rejects leaked fields', () => {
  const railway = {
    railway_access: 'available',
    connection: {
      connected: true,
      account: 'owner@example.com',
      workspace: 'Personal',
      plan: 'hobby',
      deploy_blocked: '',
    },
    instances: [{
      id: 'mob_example',
      name: 'Writing room',
      status: 'ready',
      url: 'https://writing.example',
      railway_url: 'https://railway.com/project/project',
      current_step: 'Ready',
      last_error: null,
      resources: {
        cpu: null,
        memory_mb: null,
        volume_size_mb: 5000,
        plan: 'hobby',
      },
      actions: { edit_resources: true, retry: false, delete: true },
    }],
  }
  assert.equal(parseRailway(railway), railway)
  assert.throws(() => parseRailway({
    ...railway,
    instances: [{ ...railway.instances[0], access_token: 'secret' }],
  }))
  assert.throws(() => parseRailway({
    railway_access: 'reconnect',
    connection: railway.connection,
    instances: [],
  }))
})

test('accepts an optional plan_limits block and rejects a malformed one', () => {
  const base = {
    railway_access: 'available',
    connection: {
      connected: true,
      account: 'owner@example.com',
      workspace: 'Personal',
      plan: 'hobby',
      deploy_blocked: '',
    },
    instances: [],
  }
  // Absent plan_limits stays valid (older account host).
  assert.equal(parseRailway(base), base)

  const limits = {
    cpu_choices: [1, 2, 4, 8],
    max_cpu: 8,
    memory_options_mb: [512, 1024, 2048, 4096, 8192],
    max_memory_mb: 8192,
    volume_options_mb: [500, 1000, 2000, 5000],
    default_volume_mb: 2000,
  }
  const withLimits = { ...base, connection: { ...base.connection, plan_limits: limits } }
  assert.equal(parseRailway(withLimits), withLimits)

  // Malformed plan_limits is DROPPED (pickers omitted) — the panel is NOT blanked.
  const drifted = parseRailway({
    ...base,
    connection: { ...base.connection, plan_limits: { ...limits, max_cpu: '8' } },
  })
  assert.equal(drifted.connection.plan_limits, undefined)
  const partial = parseRailway({
    ...base,
    connection: { ...base.connection, plan_limits: { cpu_choices: [1] } },
  })
  assert.equal(partial.connection.plan_limits, undefined)
  // Extra keys and empty option lists a newer host may send are tolerated (kept).
  const extended = parseRailway({
    ...base,
    connection: { ...base.connection, plan_limits: { ...limits, max_volume_mb: 5000 } },
  })
  assert.ok(extended.connection.plan_limits)
  const emptyChoices = parseRailway({
    ...base,
    connection: { ...base.connection, plan_limits: { ...limits, cpu_choices: [] } },
  })
  assert.ok(emptyChoices.connection.plan_limits)
  // An unrelated extra key on the connection is still rejected.
  assert.throws(() => parseRailway({
    ...base,
    connection: { ...base.connection, surprise: true },
  }))
})

test('accepts advertised image-update controls without requiring them from older hosts', () => {
  const base = {
    railway_access: 'available',
    connection: {
      connected: true,
      account: 'owner@example.com',
      workspace: 'Personal',
      plan: 'hobby',
      deploy_blocked: '',
      update_policies: ['automatic', 'manual'],
    },
    instances: [{
      id: 'mob_example',
      name: 'Writing room',
      status: 'ready',
      url: 'https://writing.example',
      railway_url: 'https://railway.com/project/project',
      current_step: 'Ready',
      last_error: null,
      resources: {
        cpu: null, memory_mb: null, volume_size_mb: 5000, plan: 'hobby',
      },
      updates: { policy: 'manual', state: 'current', error: null },
      actions: {
        edit_resources: true, edit_updates: true, retry: false, delete: true,
      },
    }],
  }
  assert.equal(parseRailway(base), base)

  const drifted = parseRailway({
    ...base,
    connection: { ...base.connection, update_policies: ['sometimes'] },
  })
  assert.equal(drifted.connection.update_policies, undefined)
  assert.throws(() => parseRailway({
    ...base,
    instances: [{
      ...base.instances[0],
      updates: { policy: 'sometimes', state: 'current', error: null },
    }],
  }))
})

test('presents deletion failures as deletion recovery, never as a build retry', () => {
  const failed = deploymentPresentation({
    status: 'delete_failed',
    current_step: 'Delete failed',
    last_error: "Möbius couldn't check the build just now. It will keep trying.",
  })
  assert.equal(failed.label, 'Deletion needs attention')
  assert.equal(failed.actionLabel, 'Review')
  assert.match(failed.detail, /confirm whether Railway removed this project/)
  assert.doesNotMatch(failed.detail, /build/i)

  const reconnect = deploymentPresentation({
    status: 'delete_failed',
    current_step: 'Delete failed',
    last_error: 'Reconnect the Railway account shown on this deployment, then retry deletion.',
  })
  assert.match(reconnect.detail, /Reconnect the Railway account/)
  assert.equal(deploymentPresentation({ status: 'future_state' }).tone, 'muted')
})

test('accepts only bounded deletion recovery state', () => {
  const diagnosis = {
    state: 'missing_unconfirmed',
    message: 'Railway says this project may already be gone.',
    can_confirm_absent: true,
  }
  assert.equal(parseDeletionDiagnosis(diagnosis), diagnosis)
  assert.throws(() => parseDeletionDiagnosis({ ...diagnosis, state: 'deleted' }))
  assert.throws(() => parseDeletionDiagnosis({ ...diagnosis, state: 'present' }))
  assert.throws(() => parseDeletionDiagnosis({ ...diagnosis, can_confirm_absent: false }))
  assert.throws(() => parseDeletionDiagnosis({ ...diagnosis, message: 'x'.repeat(361) }))
  assert.throws(() => parseDeletionDiagnosis({ ...diagnosis, extra: true }))
})

test('tracks only Railway states that can settle without another owner action', () => {
  for (const status of ['queued', 'creating', 'deploying', 'deleting']) {
    assert.equal(deploymentNeedsTracking({ status }), true)
  }
  for (const status of ['ready', 'active', 'error', 'delete_failed', 'deleted']) {
    assert.equal(deploymentNeedsTracking({ status }), false)
  }
  for (const updateState of ['pending', 'checking', 'retry']) {
    assert.equal(deploymentNeedsTracking({
      status: 'ready', updates: { state: updateState },
    }), true)
  }
  assert.equal(deploymentNeedsTracking({
    status: 'ready', updates: { state: 'current' },
  }), false)
})

test('keeps container replacement in Möbius Settings instead of deployment controls', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /Automatic release updates/)
  assert.doesNotMatch(source, /settings\.update_policy/)
  assert.doesNotMatch(source, /`\/deployments\/\$\{id\}\/updates`/)
  assert.doesNotMatch(source, /update_policy:/)
  assert.doesNotMatch(source, /adopt-current|adoptCurrent|adoptingCurrent|Connect this Railway deployment/)
  assert.match(source, /Container updates stay in the normal Settings flow/)
})

test('lists only deployments the account service already knows', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')

  const parsed = parseRailway({
    railway_access: 'available',
    connection: {
      connected: true,
      account: 'owner@example.com',
      workspace: 'Personal',
      plan: 'hobby',
      deploy_blocked: '',
      adopt_current: true,
    },
    instances: [],
  })
  assert.equal(parsed.connection.adopt_current, undefined)

  assert.doesNotMatch(source, /\/railway\/deployments\/adopt-current/)
  assert.doesNotMatch(source, /Hosted with Railway/)
  assert.match(source, /Railway workspace connected/)
  assert.match(source, /managedByOrigin\.get\(deploymentOrigin\(item\.url\)\)/)
  assert.match(source, /instance\.actions\.recover !== false/)
})

test('wires deletion recovery through the reviewed server confirmation path', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')

  assert.match(source, /`\/railway\/deployments\/\$\{instance\.id\}\/deletion`/)
  assert.match(source, /diagnosis\?\.can_confirm_absent && !confirmRecord/)
  assert.match(source, /`\/deployments\/\$\{id\}\/confirm-absent`/)
  assert.match(source, /JSON\.stringify\(\{ confirmed_absent: true \}\)/)
})

test('broker registers before navigation and accepts only the parent-forwarded result', async () => {
  const { target, posts, parentWindow, popup, waiting } = brokerFixture()
  assert.equal(popup.navigated, null)
  assert.deepEqual(posts[0], {
    message: {
      type: 'moebius:account-link-register',
      authorizationOrigin: 'https://www.mobius.you',
      state: linkAttempt.state,
      expiresAt: linkAttempt.expires_at,
    },
    origin: 'https://mobius.example',
  })

  emit(target, {}, 'https://mobius.example', {
    type: 'moebius:account-link-registered',
    state: linkAttempt.state,
  })
  assert.equal(popup.navigated, null)
  emit(target, parentWindow, 'https://mobius.example', {
    type: 'moebius:account-link-registered',
    state: linkAttempt.state,
  })
  assert.equal(popup.navigated, linkAttempt.authorization_url)

  emit(target, parentWindow, 'https://evil.example', {
    type: 'moebius:account-link-result',
    authorizationOrigin: 'https://www.mobius.you',
    state: linkAttempt.state,
    code: 'c'.repeat(43),
  })
  emit(target, parentWindow, 'https://mobius.example', {
    type: 'moebius:account-link-result',
    authorizationOrigin: 'https://www.mobius.you',
    state: linkAttempt.state,
    code: 'c'.repeat(43),
  })
  assert.deepEqual(await waiting, {
    code: 'c'.repeat(43),
    state: linkAttempt.state,
  })
  assert.equal(popup.closed, true)
  assert.equal(target.listeners, 0)
  assert.equal(posts.at(-1).message.type, 'moebius:account-link-unregister')
})

test('broker detects popup close, unregisters and cleans up', async () => {
  const fixture = brokerFixture({ closedPollMs: 5 })
  fixture.popup.closed = true
  await assert.rejects(fixture.waiting, /window was closed/)
  assert.equal(fixture.target.listeners, 0)
  assert.equal(
    fixture.posts.at(-1).message.type,
    'moebius:account-link-unregister',
  )
})

test('broker aborts and times out registration without leaking listeners', async () => {
  const controller = new AbortController()
  const cancelled = brokerFixture({ signal: controller.signal })
  controller.abort()
  await assert.rejects(cancelled.waiting, /cancelled/)
  assert.equal(cancelled.target.listeners, 0)

  const timedOut = brokerFixture({ registrationTimeoutMs: 5 })
  await assert.rejects(timedOut.waiting, /prepare secure sign-in/)
  assert.equal(timedOut.target.listeners, 0)
})

test('initial account load preserves the page shape instead of centering a spinner', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')

  assert.match(source, /function IdentityLoading\(\{ appId \}\)/)
  assert.match(source, /<Brand[\s\S]*?Checking account…/)
  assert.match(source, /id-loading-avatar/)
  assert.match(source, /id-loading-deploy-name/)
  assert.doesNotMatch(source, /className="id-loading"[\s\S]*?ArrowRotateCw/)
})

test('the loaded account body remains inside the scroll container', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')

  assert.match(
    source,
    /onUnlink=\{mode === 'linked'[\s\S]*?<div className="id-scroll">\s*<div className="id-shell">/,
  )
})

test('parseIdentity accepts an optional linked_at instant', () => {
  const base = {
    account_mode: 'linked',
    account_unavailable: false,
    instance_id: null,
    profile: {
      user_id: 'usr_1',
      email: 'owner@example.com',
      display_name: 'Owner',
      handle: 'owner',
      avatar_url: null,
    },
    deployments: [{
      id: 'local', name: 'This Möbius', status: 'Active',
      url: 'https://example.com', current: true,
    }],
  }
  assert.equal(parseIdentity({ ...base }).linked_at, undefined)
  assert.equal(parseIdentity({ ...base, linked_at: null }).linked_at, null)
  assert.equal(
    parseIdentity({ ...base, linked_at: '2026-08-23T17:00:00Z' }).linked_at,
    '2026-08-23T17:00:00Z',
  )
  assert.throws(() => parseIdentity({ ...base, linked_at: 'not-a-date' }))
  assert.throws(() => parseIdentity({ ...base, linked_at: 12345 }))
})
