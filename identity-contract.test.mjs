import test from 'node:test'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

import {
  accountConfirmUrl,
  accountStatus,
  agentAccessPresentation,
  deploymentCanRecover,
  deploymentCanOpen,
  dashboardUrl,
  deploymentIsBuilding,
  deploymentNeedsTracking,
  deploymentPresentation,
  formatMembershipMonth,
  parseAgentAccess,
  parseIdentity,
  parseLinkAttempt,
  parseRailway,
  railwayAccountChanged,
  waitForAccountLink,
} from './identity-contract.js'

test('offers Recovery for running and failed deployments unless withheld', () => {
  const deployment = (status, actions = {}) => ({ status, actions })
  assert.equal(deploymentCanRecover(deployment('ready')), true)
  assert.equal(deploymentCanRecover(deployment('error')), true)
  assert.equal(deploymentCanRecover(deployment('error', { recover: true })), true)
  assert.equal(deploymentCanRecover(deployment('ready', { recover: false })), false)
  for (const status of ['provisioning', 'building', 'deleting', 'delete_failed', 'deleted']) {
    assert.equal(deploymentCanRecover(deployment(status)), false, status)
  }
})

test('Recovery is account-owned navigation, never a local worker start', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /deploymentCanRecover\(managed\)/)
  assert.match(source, /label="Recover"/)
  assert.doesNotMatch(source, /function RecoverySection|recovery\/status|method: 'POST'.*recovery/)
})

test('only confirmed ready deployments can open; cancellation remains dashboard-owned', async () => {
  for (const status of ['ready', 'active']) assert.equal(deploymentCanOpen({status}), true)
  for (const status of ['queued','creating','deploying','error','delete_failed','deleting','deleted','unknown']) assert.equal(deploymentCanOpen({status}), false, status)
  for (const status of ['queued','creating','deploying']) assert.equal(deploymentIsBuilding({status}), true)
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /disabled=\{!canOpen\}/)
  assert.match(source, /building \? 'Cancel deployment' : 'Delete'/)
  assert.doesNotMatch(source, /function DeleteDeploymentModal|\/railway\/disconnect|\/deployments\/\$\{id\}.*method: 'DELETE'/)
})

test('membership months do not shift across local time zones', () => {
  assert.equal(formatMembershipMonth('2026-03-01', 'en-US'), 'Mar 2026')
  assert.equal(formatMembershipMonth(null, 'en-US'), null)
})

test('model access accepts stable aliases and rejects hidden or malformed prices', () => {
  const value = {
    agent_access: 'available',
    models: [{
      id: 'evolve',
      name: 'Evolve',
      pricing: { input: 0.3, cached_input: 0.01, output: 1.2 },
      context_window: 1_000_000,
    }],
    balance: { available_units: 2_000_000 },
    trial: { state: 'ready' },
    retention: {
      policy: 'local-testing-v1',
      notice: 'Test conversations are stored privately for testing.',
    },
  }
  assert.equal(parseAgentAccess(value).models[0].name, 'Evolve')
  assert.throws(() => parseAgentAccess({
    ...value,
    models: [{ ...value.models[0], pricing: { input: -1, cached_input: 0, output: 1 } }],
  }))
  assert.throws(() => parseAgentAccess({ ...value, provider: 'openrouter' }))
  assert.throws(() => parseAgentAccess({
    ...value,
    balance: { available_units: -1 },
  }))
  assert.throws(() => parseAgentAccess({
    ...value,
    models: [value.models[0], value.models[0]],
  }))
  for (const leaked of [
    { ...value, models: [{ ...value.models[0], provider: 'hidden' }] },
    { ...value, models: [{ ...value.models[0], pricing: { ...value.models[0].pricing, route: 'hidden' } }] },
    { ...value, balance: { ...value.balance, provider_account: 'hidden' } },
    { ...value, trial: { ...value.trial, campaign: 'hidden' } },
    { ...value, retention: { ...value.retention, training_bucket: 'hidden' } },
  ]) assert.throws(() => parseAgentAccess(leaked))
  assert.equal(parseAgentAccess({
    agent_access: 'signed_out',
    models: [],
    balance: {},
    trial: {},
    retention: {},
  }).agent_access, 'signed_out')
  assert.throws(() => parseAgentAccess({
    agent_access: 'unavailable',
    models: [],
    balance: { available_units: 1 },
    trial: {},
    retention: {},
  }))
})

test('model access distinguishes a new trial from an older account', () => {
  const base = {
    balance: { available_units: 1_500_000 },
    trial: { state: 'ready' },
    retention: { policy: 'local-testing-v1', notice: 'Stored privately for testing.' },
  }
  assert.deepEqual(agentAccessPresentation(base), {
    needsActivation: true,
    title: 'Start with $2 on us',
    action: 'Activate $2 trial',
    showBalance: false,
    empty: false,
  })
  const existing = agentAccessPresentation({ ...base, trial: { state: 'expired' } })
  assert.equal(existing.title, 'Model access is active')
  assert.equal(existing.needsActivation, false)
})

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
  member_since: null,
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
    instance_id: 'mob_123',
    profile: { ...profile, email: null },
  }))
  assert.throws(() => parseIdentity({
    ...baseIdentity,
    account_mode: 'linked',
    profile: { ...profile, email: null },
  }))
  assert.doesNotThrow(() => parseIdentity({
    ...baseIdentity,
    account_mode: 'managed',
    account_unavailable: true,
    instance_id: 'mob_123',
    profile: {
      ...profile,
      email: null,
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
  assert.throws(() => parseIdentity({
    ...baseIdentity,
    account_mode: 'managed',
    instance_id: 'mob_123',
    profile: { ...profile, email: 'not-an-email' },
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

test('accepts a connection of only connected and account and ignores the old saved workspace', () => {
  const minimal = {
    railway_access: 'available',
    connection: { connected: true, account: 'owner@example.com' },
    instances: [],
  }
  assert.deepEqual(parseRailway(minimal).connection, { connected: true, account: 'owner@example.com' })
  assert.throws(() => parseRailway({ ...minimal, connection: { connected: true } }))
  assert.throws(() => parseRailway({ ...minimal, connection: { account: 'owner@example.com' } }))
  assert.throws(() => parseRailway({ ...minimal, connection: { connected: true, account: 'x'.repeat(321) } }))

  // An older launcher still sends the saved default: tolerated, even malformed, and never kept.
  const limits = {
    cpu_choices: [1, 2], max_cpu: 2, memory_options_mb: [512], max_memory_mb: 512,
    volume_options_mb: [500], default_volume_mb: 500,
  }
  const old = parseRailway({
    ...minimal,
    connection: {
      ...minimal.connection, workspace: 'Personal', plan: 'hobby', deploy_blocked: 'Add a card',
      plan_limits: limits,
    },
  })
  assert.deepEqual(old.connection, minimal.connection)
  const odd = parseRailway({
    ...minimal,
    connection: { ...minimal.connection, workspace: 7, plan: null, deploy_blocked: {}, plan_limits: 'x' },
  })
  assert.deepEqual(odd.connection, minimal.connection)

  // An unrelated extra key on the connection is still rejected.
  assert.throws(() => parseRailway({
    ...minimal,
    connection: { ...minimal.connection, surprise: true },
  }))
})

test('legacy connection-wide workspace handling is gone', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /workspaceChosenOnCreate|reloadWorkspaces|workspaceSequenceRef/)
  assert.doesNotMatch(source, /\/railway\/workspaces|'\/railway\/workspace'/)
  assert.doesNotMatch(source, /connection\??\.(plan_limits|plan|workspace|deploy_blocked)\b/)
  assert.doesNotMatch(source, /connectionLimits|connectionPlan/)
})

test('a deployment may name its workspace, and a malformed value only loses that', () => {
  const base = {
    id: 'mob_abc', name: 'A', status: 'ready', url: null, railway_url: null,
    current_step: null, last_error: null,
    resources: { cpu: null, memory_mb: null, volume_size_mb: null, plan: 'pro' },
    actions: { edit_resources: true, retry: false, delete: true },
  }
  const parse = instance => parseRailway({
    railway_access: 'available', connection: null, instances: [instance],
  }).instances[0]
  assert.equal(parse({ ...base, workspace_id: 'ws_team' }).workspace_id, 'ws_team')
  assert.equal(parse({ ...base, workspace_id: null }).workspace_id, null)
  assert.equal('workspace_id' in parse(base), false)
  for (const bad of [7, '', 'x'.repeat(129), {}]) {
    assert.equal('workspace_id' in parse({ ...base, workspace_id: bad }), false)
  }
  assert.throws(() => parse({ ...base, other: 1 }))
})

test('resource summaries use the deployment inventory, not another workspace ceiling', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /resourceSummary\(managed\.resources\)/)
  assert.match(source, /label="Change on mobius.you"/)
  assert.doesNotMatch(source, /function ResourceFields|onCompute|onStorage/)
})

test('opts into the configured dashboard address without unused creation metadata', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /identityRequest\(token, '\/railway\?dashboard=1'\)/)
})

test('account replacement still waits for authoritative inventory', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /return next\s*\n\s*}\s*\n\s*if \(popup\.closed\)/)
})

test('retains image-update status but discards retired authoring capabilities', () => {
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

test('keeps resource information and rename local while protected edits navigate away', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /function DeploymentNameEditor\(/)
  assert.match(source, /onSave=\{name => onRename\(managed\.id, \{ name \}\)\}/)
  assert.match(source, /managed\.actions\.edit_resources/)
  assert.match(source, /resourceSummary\(managed\.resources\)/)
  assert.doesNotMatch(source, /function ManageDeploymentPanel|function RecoverySection|function DeleteDeploymentModal|function NewDeploymentModal/)
})

test('refreshes visible deployment metrics without opening management', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  const metricsStart = source.indexOf('function DeploymentMetrics(')
  const metricsEnd = source.indexOf('function RailwayConnectionModal(', metricsStart)
  const metricsSource = source.slice(metricsStart, metricsEnd)

  assert.match(metricsSource, /setTimeout\(refresh, 15000\)/)
  assert.match(metricsSource, /controller === requestController/)
  assert.match(metricsSource, /visibilitychange/)
  assert.match(metricsSource, /window\.addEventListener\('focus', resume\)/)
  assert.match(source, /managed\?\.status === 'ready'[\s\S]*?<DeploymentMetrics token=\{token\} instance=\{managed\}/)
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
  assert.match(source, /Railway connected/)
  assert.match(source, /managedByOrigin\.get\(deploymentOrigin\(item\.url\)\)/)
  assert.match(source, /deploymentCanRecover\(managed\)/)
})

test('changing Railway account waits for a different connected account', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /Railway account<\/h2>/)
  assert.match(source, /Manage plan on Railway/)
  assert.doesNotMatch(source, /\/railway\/plan\/refresh|Refresh plans/)
  assert.match(source, /Change hosting account/)
  const previous = 'first@example.com'
  assert.equal(railwayAccountChanged(previous, null), false)
  assert.equal(railwayAccountChanged(previous, { connection: { connected: false, account: 'second@example.com' } }), false)
  assert.equal(railwayAccountChanged(previous, { connection: { connected: true, account: previous } }), false)
  assert.equal(railwayAccountChanged(previous, { connection: { connected: true, account: 'second@example.com' } }), true)
  assert.match(source, /replace \? railwayAccountChanged\(previousAccount, next\) : next\?\.connection\?\.connected/)
  assert.match(source, /href="https:\/\/railway\.com\/workspace\/plans"/)
  assert.doesNotMatch(source, /onClick=\{\(\) => \{ onClose\(\); onChangeAccount\(\) \}\}/)
})

test('failed cards offer manual record-removal navigation, never automatic or local removal', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /\['error', 'delete_failed'\]\.includes\(managed\?\.status\)/)
  assert.match(source, /label="Remove from dashboard"/)
  assert.match(source, /hidden project may still be running and billed/)
  assert.doesNotMatch(source, /confirm-absent|function DeletionRecoverySection/)
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

test('the membership date is not presented as a link date', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')

  assert.match(source, /const memberSince = formatMembershipMonth\(data\.member_since\)/)
  assert.match(source, /Member since/)
  assert.doesNotMatch(source, /Linked since|linkedSince/)
})

test('parseIdentity requires the current member_since date', () => {
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
  assert.equal(parseIdentity({ ...base, member_since: null }).member_since, null)
  assert.equal(
    parseIdentity({ ...base, member_since: '2026-08-23' }).member_since,
    '2026-08-23',
  )
  assert.throws(() => parseIdentity({ ...base }))
  assert.throws(() => parseIdentity({ ...base, linked_at: '2026-08-23T17:00:00Z' }))
  assert.throws(() => parseIdentity({ ...base, member_since: 'not-a-date' }))
  assert.throws(() => parseIdentity({ ...base, member_since: 12345 }))
})

test('an unavailable Railway read offers a labelled Try again that re-reads it', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /The Möbius account service did not return your Railway state\./)
  assert.match(source, /onRetryRailway=\{loadRailway\}/)
  assert.match(source, /await onRetryRailway\(\)\s+\} finally \{\s+setRetryingRailway\(false\)/)
  assert.match(source, /onClick=\{retryRailway\}\s+disabled=\{retryingRailway\}/)
  assert.match(source, /aria-label="Try again to load Railway controls"/)
})

test('account confirmation accepts only an https dashboard link for its own code', () => {
  assert.equal(
    accountConfirmUrl({
      code: 'confirm_on_account',
      message: 'Finish this on your mobius.you dashboard.',
      confirm_url: 'https://www.mobius.you/dashboard',
    }),
    'https://www.mobius.you/dashboard',
  )
  for (const detail of [
    null,
    'Finish this on mobius.you',
    { code: 'other', confirm_url: 'https://www.mobius.you/dashboard' },
    { code: 'confirm_on_account', confirm_url: 'http://www.mobius.you/dashboard' },
    { code: 'confirm_on_account', confirm_url: 'javascript:alert(1)' },
    { code: 'confirm_on_account', confirm_url: 'https://www.mobius.you/elsewhere' },
    { code: 'confirm_on_account', confirm_url: 'https://www.mobius.you/dashboard?next=x' },
    { code: 'confirm_on_account', confirm_url: 'https://user:pw@www.mobius.you/dashboard' },
  ]) {
    assert.equal(accountConfirmUrl(detail), '')
  }
})

test('dashboard address is an optional safe extension, not a hard-coded account host', () => {
  const base = {railway_access:'available',connection:null,instances:[]}
  assert.equal(parseRailway({...base}).dashboard_url,undefined)
  const url='https://accounts.example.test/dashboard'
  assert.equal(parseRailway({...base,dashboard_url:url}).dashboard_url,url)
  for(const bad of ['http://accounts.example.test/dashboard','javascript:alert(1)','https://name:pass@accounts.example.test/dashboard','https://accounts.example.test/other','https://accounts.example.test/dashboard?next=other','https://accounts.example.test/dashboard#other',{}]) {
    assert.equal(dashboardUrl(bad),'')
    assert.equal(parseRailway({...base,dashboard_url:bad}).dashboard_url,undefined)
  }
})


test('discards legacy creation metadata without hiding deployments or connection', () => {
  for (const value of [null, 'drifted', { future: true }]) {
    const connection = { connected: true, account: 'owner@example.test' }
    const extensions = ['workspace', 'plan', 'deploy_blocked', 'plan_limits',
      'update_policies', 'adopt_current', 'region_options']
    const wire = Object.fromEntries(extensions.map(key => [key, value]))
    const parsed = parseRailway({ railway_access: 'available', instances: [],
      connection: { ...connection, ...wire } })
    assert.deepEqual(parsed.connection, connection)
  }
})

test('deployment authoring has no duplicate workspace/region/plan state in the app', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /workspace-plans|workspace_ids|loadWorkspacePlans|plansSequenceRef|Refresh plans/)
  assert.match(source, /label="New deployment"/)
  assert.match(source, /resourceSummary\(managed\.resources\)/)
})
