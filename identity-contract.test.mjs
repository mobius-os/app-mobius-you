import test from 'node:test'
import assert from 'node:assert/strict'

import {
  accountStatus,
  parseIdentity,
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
