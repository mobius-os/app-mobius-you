import test from 'node:test'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

import {
  accountStatus,
  agentAccessPresentation,
  deploymentCanRecover,
  deploymentIsBuilding,
  deploymentNeedsTracking,
  deploymentPresentation,
  formatMembershipMonth,
  parseAgentAccess,
  parseIdentity,
  parseDeletionDiagnosis,
  parseLinkAttempt,
  parseRailway,
  parseWorkspacePlans,
  railwayAccountChanged,
  suggestRailwayRegion,
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

test('the Recover action reveals only its Recovery section', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /onClick=\{\(\) => onManage\(managed, 'recovery'\)\}/)
  assert.match(source, /open=\{section === 'recovery' \|\| undefined\}/)
  assert.equal((source.match(/deploymentCanRecover\(/g) || []).length, 2)
})

test('building deployments offer a distinct cancellation path, not a live-app link', async () => {
  for (const status of ['queued', 'creating', 'deploying']) {
    assert.equal(deploymentIsBuilding({ status }), true, status)
  }
  for (const status of ['ready', 'error', 'deleting', 'deleted']) {
    assert.equal(deploymentIsBuilding({ status }), false, status)
  }
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /item\.url && !item\.current && !building/)
  assert.doesNotMatch(source, /onManage\(managed, 'resources'\)/)
  assert.match(source, /building \? 'Cancel deployment' : 'Delete'/)
  assert.match(source, /cancellingBuild \? 'Keep building' : 'Keep deployment'/)
  assert.match(source, /If Railway has created a project and storage volume, they will be removed/)
  assert.match(source, /cancellingBuild \? 'Cancel and remove' : 'Delete permanently'/)
  assert.match(source, /onDelete=\{id => railwayAction\(`\/deployments\/\$\{id\}`, \{ method: 'DELETE' \}\)\}/)
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

test('suggests a nearby single region from time zone and gates region controls', () => {
  assert.equal(suggestRailwayRegion('Europe/London', 60), 'europe-west4-drams3a')
  assert.equal(suggestRailwayRegion('America/Los_Angeles', -420), 'us-west2')
  assert.equal(suggestRailwayRegion('America/Chicago', -360), 'us-east4-eqdc4a')
  assert.equal(suggestRailwayRegion('Asia/Singapore', 480), 'asia-southeast1-eqsg3a')
  assert.equal(suggestRailwayRegion('Etc/UTC', 0), '')
  const base = {
    railway_access: 'available',
    connection: {
      connected: true, account: 'owner@example.com', workspace: 'Personal',
      plan: 'hobby', deploy_blocked: '',
    },
    instances: [],
  }
  assert.equal(parseRailway(base).connection.region_options, undefined)
  const regions = [
    ['us-west2', 'US West'], ['us-east4-eqdc4a', 'US East'],
    ['europe-west4-drams3a', 'Europe'], ['asia-southeast1-eqsg3a', 'Asia Pacific'],
  ].map(([id, label]) => ({ id, label }))
  const advertised = parseRailway({
    ...base, connection: { ...base.connection, region_options: regions },
  })
  assert.deepEqual(advertised.connection.region_options, regions)
  const malformed = parseRailway({
    ...base, connection: { ...base.connection, region_options: [{ id: 'unknown', label: 'No' }] },
  })
  assert.equal(malformed.connection.region_options, undefined)
})

test('validates per-workspace plan data strictly', () => {
  const limits = {
    cpu_choices: [1, 2, 4],
    max_cpu: 4,
    default_cpu: 2,
    memory_options_mb: [512, 1024, 2048],
    max_memory_mb: 2048,
    default_memory_mb: 1024,
    volume_options_mb: [500, 1000],
    default_volume_mb: 500,
    included_usd: 5,
  }
  const entry = (id, patch = {}) => ({
    id, name: `Workspace ${id}`, plan: 'hobby', deploy_blocked: '', plan_limits: limits, ...patch,
  })
  const valid = { workspaces: [entry('a'), entry('b', { plan: 'unknown' }), entry('c', { plan: 'enterprise' })], current: 'b' }
  assert.equal(parseWorkspacePlans(valid), valid)
  const nullCurrent = { workspaces: [], current: null }
  assert.equal(parseWorkspacePlans(nullCurrent), nullCurrent)

  const rejected = [
    { ...valid, extra: true },
    { workspaces: valid.workspaces },
    { ...valid, workspaces: 'a' },
    { ...valid, current: 7 },
    { ...valid, current: 'x'.repeat(129) },
    { ...valid, workspaces: [{ ...entry('a'), extra: 1 }] },
    { ...valid, workspaces: [{ id: 'a', name: 'A', plan: 'hobby', deploy_blocked: '' }] },
    { ...valid, workspaces: [entry('a', { id: 7 })] },
    { ...valid, workspaces: [entry('')] },
    { ...valid, workspaces: [entry('a', { name: '' })] },
    { ...valid, workspaces: [entry('a', { plan: 'platinum' })] },
    { ...valid, workspaces: [entry('a', { deploy_blocked: null })] },
    { ...valid, workspaces: [entry('a', { plan_limits: { ...limits, max_cpu: '4' } })] },
    { ...valid, workspaces: [entry('a', { plan_limits: null })] },
    { ...valid, workspaces: [entry('a'), entry('a')] },
    { ...valid, workspaces: Array.from({ length: 101 }, (_, i) => entry(`w${i}`)) },
    { ...valid, workspaces: [entry('x'.repeat(129))] },
    { ...valid, workspaces: [entry('a', { name: 'x'.repeat(129) })] },
    { ...valid, workspaces: [entry('a', { deploy_blocked: 'x'.repeat(1001) })] },
  ]
  for (const value of rejected) assert.throws(() => parseWorkspacePlans(value))
  const maximal = { workspaces: Array.from({ length: 100 }, (_, i) => entry(`w${i}`)), current: null }
  assert.equal(parseWorkspacePlans(maximal), maximal)
})

test('the create form owns the workspace only when workspace plans are advertised', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /identityRequest\(token, '\/railway\/workspace-plans'\)\.catch\(\(\) => null\)/)
  assert.match(source, /if \(workspace\) settings\.workspace_id = workspace\.id/)
  assert.match(source, /workspaceChosenOnCreate=\{Boolean\(workspacePlans\)\}/)
  assert.match(source, /workspaces\.length > 1 && !workspaceChosenOnCreate/)
  // A possibly stale blocked notice never disables creating: the launcher re-checks live.
  assert.doesNotMatch(source, /Boolean\(blocked\)/)
  assert.doesNotMatch(source, /!name\.trim\(\) \|\| blocked/)
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

test('resource limits follow the deployment\'s own workspace with the connection as fallback', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /find\(item => item\.id === instance\.workspace_id\)\?\.plan_limits/)
  assert.match(source, /\?\? railway\?\.connection\?\.plan_limits/)
  assert.match(source, /planLimits=\{limitsFor\(managed\)\}/)
})

test('opts into region choices through the platform inventory bridge', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /identityRequest\(token, '\/railway\?region_options=1&workspace_ids=1'\)/)
})

test('shows advertised region choice without plan limits and reloads workspaces after account replacement', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /\(planLimits \|\| regionOptions\?\.length > 0\)/)
  assert.match(source, /if \(next\) await reloadWorkspaces\(\)/)
  assert.match(source, /const sequence = \+\+workspaceSequenceRef\.current/)
  assert.match(source, /return next\s*\n\s*}\s*\n\s*if \(popup\.closed\)/)
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

test('keeps Resources below each eligible deployment without a redundant Manage action', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  const manageStart = source.indexOf('function ManageDeploymentPanel(')
  const manageEnd = source.indexOf('function DeleteDeploymentModal(', manageStart)
  const manageSource = source.slice(manageStart, manageEnd)

  assert.match(source, /function DeploymentNameEditor\(/)
  assert.match(source, /<Pencil width=\{14\}/)
  assert.match(source, /onSave=\{name => onRename\(managed\.id, \{ name \}\)\}/)
  assert.match(source, /managed && \(managed\.actions\.edit_resources/)
  assert.doesNotMatch(source, /onManage\(managed, 'resources'\)/)
  assert.doesNotMatch(source, /\{state\.actionLabel\}/)
  assert.match(source, /managed\.railway_url && \(/)
  assert.match(source, /<Lifesaver width=\{14\}/)
  assert.match(source, /<Trash width=\{14\}/)
  assert.doesNotMatch(manageSource, /id-modal-backdrop|role="dialog"/)
  assert.doesNotMatch(manageSource, /DeploymentMetrics|DeploymentNameEditor|Delete deployment/)
  assert.match(manageSource, /<span className="id-disclosure-title">Resources<\/span>/)
  assert.match(manageSource, /section === 'recovery' && deploymentCanRecover\(instance\)/)
  assert.match(manageSource, /<ResourceFields/)
  assert.match(manageSource, /<RecoverySection/)
  assert.match(manageSource, /instance\.status !== 'delete_failed' && instance\.actions\.retry/)
  assert.match(manageSource, /onRetry\(instance\.id\)/)
  assert.match(manageSource, /Review increase/)
  assert.match(manageSource, /Update compute/)
  assert.match(manageSource, /Attached storage can only be increased, not reduced\./)
  assert.match(manageSource, /volume_options_mb\.find\(value => value > current\)/)
  assert.match(manageSource, /setConfirmVolume\(Number\(volume\)\)/)
  assert.match(manageSource, /This volume can only grow\. You won’t be able to reduce it later\./)
  assert.match(manageSource, /onStorage\(instance\.id, \{ volume_mb: confirmVolume \}\)/)
  assert.match(source, /onRetry=\{id => railwayAction\(`\/deployments\/\$\{id\}\/retry`/)
})

test('refreshes visible deployment metrics without opening management', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  const metricsStart = source.indexOf('function DeploymentMetrics(')
  const metricsEnd = source.indexOf('function RecoverySection(', metricsStart)
  const metricsSource = source.slice(metricsStart, metricsEnd)

  assert.match(metricsSource, /setTimeout\(refresh, 15000\)/)
  assert.match(metricsSource, /controller === requestController/)
  assert.match(metricsSource, /visibilitychange/)
  assert.match(metricsSource, /window\.addEventListener\('focus', resume\)/)
  assert.match(source, /managed\?\.status === 'ready'[\s\S]*?<DeploymentMetrics token=\{token\} instance=\{managed\} compact/)
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
  assert.match(source, /deploymentCanRecover\(instance\)/)
})

test('changing Railway account waits for a different connected account', async () => {
  const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
  assert.match(source, /Railway account<\/h2>/)
  assert.match(source, /Manage plan on Railway/)
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
