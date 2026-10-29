import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

const dom = new JSDOM('<!doctype html><body><button id="opener">Open</button><div id="root"></div></body>', { url: 'https://example.test', pretendToBeVisual: true })
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document,
  CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true,
})
const { createRoot } = await import('react-dom/client')

// Bundle the real entry, exposing its dialog components only in the test copy.
const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
const output = await build({
  stdin: {
    contents: source + '\nexport { identityRequest, Deployments, DeploymentMetrics, RailwayConnectionModal, AccountActionError, AccountConfirmNotice, DashboardAction }',
    resolveDir: new URL('.', import.meta.url).pathname,
    loader: 'jsx',
  },
  bundle: true, write: false, format: 'esm', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  plugins: [{ name: 'icons', setup(builder) {
    builder.onResolve({ filter: /^@openai\/.*Icon$/ }, () => ({ path: 'icons', namespace: 'test' }))
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
      contents: 'export const ' + [...source.match(/import \{([^}]+)\} from '@openai\/apps-sdk-ui\/components\/Icon'/)[1].matchAll(/(\w+)/g)]
        .map(match => match[1]).filter(name => /^[A-Z]/.test(name))
        .map(name => `${name} = () => null`).join(', '),
    }))
  } }],
})
const temp = new URL(`./.preview/dialog-test-${process.pid}.mjs`, import.meta.url)
await mkdir(new URL('./.preview/', import.meta.url), { recursive: true })
await writeFile(temp, output.outputFiles[0].text)
const components = await import(temp.href)
await rm(temp)

const { identityRequest, Deployments, DeploymentMetrics, RailwayConnectionModal, AccountActionError, AccountConfirmNotice, DashboardAction } = components
const App = components.default
const dashboard='https://accounts.example.test/dashboard'
const buttonTexts=()=>[...document.getElementById('root').querySelectorAll('button')].map(x=>x.textContent.trim())
async function mounted(component,props,check, responseBody={runtime:{},cpu:{},memory:{},volume:{},network:{}}) {
  const originalFetch=globalThis.fetch
  const calls=[]
  globalThis.fetch=async (url,options={})=>{
    calls.push({url,method:options.method||'GET'})
    return new Response(JSON.stringify(responseBody))
  }
  const opener=document.getElementById('opener');opener.focus()
  const root=createRoot(document.getElementById('root'))
  try {
    await act(async()=>root.render(React.createElement(component,props)))
    await check(calls)
    assert.ok(calls.every(call=>call.method==='GET'),'navigation must never submit provider mutations')
  } finally {await act(async()=>root.unmount());globalThis.fetch=originalFetch}
}
for(const status of ['ready','queued','creating','deploying','error','delete_failed','deleting']) {
  test(`${status} card matches lifecycle links and keeps protected operations dashboard-owned`,async()=>{
    const instance={id:'mob_test',name:'Test deployment',status,url:'https://deployment.example.test',railway_url:'https://railway.com/project/test',current_step:null,last_error:null,resources:{cpu:'2',memory_mb:4096,volume_size_mb:5000,plan:'pro'},actions:{delete:status!=='deleting',retry:['error','delete_failed'].includes(status),recover:['ready','error'].includes(status),edit_resources:status==='ready'}}
    await mounted(Deployments,{token:'test',items:[],railway:{railway_access:'available',dashboard_url:dashboard,connection:{connected:true,account:'test'},instances:[instance]}},async calls=>{
      const root=document.getElementById('root')
      const open=root.querySelector('button[aria-label="Open Test deployment in a new tab"]')
      assert.ok(open)
      assert.equal(open.disabled,status!=='ready')
      const railway=root.querySelector('a[href="https://railway.com/project/test"]')
      assert.equal(Boolean(railway),status!=='deleting')
      const links=[...root.querySelectorAll(`a[href="${dashboard}"]`)]
      assert.ok(links.some(link=>link.textContent.includes('New deployment')))
      for(const link of links){assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');link.focus();assert.equal(document.activeElement,link)}
      const failed=['error','delete_failed'].includes(status)
      assert.equal(links.some(link=>link.textContent.includes('Remove from dashboard')),failed)
      if(failed)assert.match(root.textContent,/may still be running and billed/)
      assert.equal(links.some(link=>link.textContent.includes('Recover')),['ready','error'].includes(status))
      assert.equal(root.querySelectorAll('form').length,0)
      assert.ok(!buttonTexts().includes('Deploy Möbius'))
      assert.ok(calls.every(call=>call.url.endsWith('/metrics?cost=1')))
    })
  })
}
for(const unsafe of [undefined,'javascript:alert(1)','http://accounts.example.test/dashboard','https://name:pass@accounts.example.test/dashboard']) {
  test(`dashboard link is safely unavailable for ${String(unsafe)}`,async()=>{
    await mounted(DashboardAction,{url:unsafe,label:'New deployment'},async calls=>{
      assert.equal(document.querySelector('#root a'),null)
      assert.equal(document.querySelector('#root button').disabled,true)
      assert.deepEqual(calls,[])
    })
  })
}
test('disconnect handoff is keyboard-accessible inside the account dialog without a write',async()=>{
  let closed=false
  await mounted(RailwayConnectionModal,{token:'test',connection:{account:'Test Railway'},dashboard,onClose:()=>{closed=true}},async calls=>{
    const dialog=document.querySelector('[role="dialog"]')
    const link=dialog.querySelector(`a[href="${dashboard}"]`)
    assert.match(link.textContent,/Disconnect on mobius.you/)
    link.focus();assert.equal(document.activeElement,link)
    const focusable=[...dialog.querySelectorAll('button:not(:disabled),[href]')]
    focusable.at(-1).focus()
    document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}))
    assert.equal(document.activeElement,focusable[0])
    assert.equal(closed,false);assert.deepEqual(calls,[])
    assert.ok(!buttonTexts().includes('Refresh plans'))
  })
  assert.equal(document.activeElement,document.getElementById('opener'))
})
for(const detail of [{code:'confirm_on_account',message:'Finish on the account dashboard.',confirm_url:dashboard},'Service unavailable.',{code:'confirm_on_account',message:'Invalid link.',confirm_url:'javascript:alert(1)'}]) {
  test('unexpected backend handoffs and ordinary errors remain visible without unsafe links',async()=>{
    const originalFetch=globalThis.fetch
    globalThis.fetch=async()=>new Response(JSON.stringify({detail}),{status:409})
    let error
    try{await identityRequest('test','/profile',{method:'PATCH'})}catch(caught){error=caught}
    finally{globalThis.fetch=originalFetch}
    assert.ok(error)
    await mounted(AccountActionError,{error},async()=>{
      assert.match(document.querySelector('[role="alert"]').textContent,/Finish|unavailable|Invalid/)
      assert.equal(Boolean(document.querySelector('#root a')),typeof detail==='object'&&detail.confirm_url===dashboard)
    })
  })
}

for(const railway_access of ['unavailable','reconnect','signed_out']) {
  test(`the account dashboard remains reachable when inventory is ${railway_access}`,async()=>{
    await mounted(Deployments,{token:'test',items:[],railway:{railway_access,dashboard_url:dashboard,connection:null,instances:[]}},async()=>{
      assert.ok(document.querySelector(`#root a[href="${dashboard}"]`))
      assert.match(document.getElementById('root').textContent,/behind your own sign-in/)
    })
  })
}
for(const cost of [undefined,{heading:'',note:'Unknown',percent:'0%'},{heading:'$0.00 estimated usage',note:'Usage available',percent:'0%'}]) {
  test(`usage display distinguishes unknown cost from a known zero: ${String(cost?.heading)}`,async()=>{
    const responseBody={runtime:{},cpu:{},memory:{},volume:{},network:{},...(cost?{cost}:{})}
    await mounted(DeploymentMetrics,{token:'test',instance:{id:'mob_test',status:'ready'}},async()=>{
      const shown=document.querySelector('.id-cost-summary')
      assert.equal(Boolean(shown),Boolean(cost?.heading))
      if(shown)assert.match(shown.textContent,/estimated usage/)
    },responseBody)
  })
}

const metrics = {
  runtime: { status_label: 'Active', region_label: 'Europe', data_status: 'Persistent and attached' },
  cpu: { label: '0.1 vCPU', limit_label: '2 vCPU', percent: '5%' },
  memory: { label: '256 MB', limit_label: '4096 MB', percent: '6%' },
  volume: { used_label: '1 GB', allocated_label: '5 GB', percent: '20%' },
  network: { rx_label: '1 MB', tx_label: '2 MB', percent: '1%' },
  cost: { heading: '$1.20 estimated usage', note: 'Estimate, not an invoice.', percent: '24%' },
}

function readyInstance() {
  return {
    id: 'mob_test', name: 'Test deployment', status: 'ready',
    url: 'https://deployment.example.test', railway_url: 'https://railway.com/project/test',
    current_step: null, last_error: null,
    resources: { cpu: '2', memory_mb: 4096, volume_size_mb: 5000, plan: 'pro' },
    actions: { delete: true, retry: false, recover: true, edit_resources: false },
  }
}

test('read-only ready cards retain resource caps and live usage without offering resource edits', async () => {
  await mounted(Deployments, {
    token: 'test', items: [], railway: {
      railway_access: 'available', dashboard_url: dashboard,
      connection: { connected: true, account: 'first@example.test' },
      instances: [readyInstance()],
    },
  }, async calls => {
    const root = document.getElementById('root')
    assert.match(root.querySelector('.id-deployment-resources').textContent, /2 vCPU · 4096 MB RAM · 5000 MB storage/)
    assert.ok(!root.textContent.includes('Change on mobius.you'))
    assert.match(root.querySelector('.id-metrics').textContent, /0\.1 vCPU/)
    assert.match(root.querySelector('.id-cost-summary').textContent, /\$1\.20 estimated usage/)
    assert.deepEqual(calls, [{
      url: '/api/identity/railway/deployments/mob_test/metrics?cost=1', method: 'GET',
    }])
  }, metrics)
})

function button(label, scope = document.getElementById('root')) {
  const found = [...scope.querySelectorAll('button')].find(item => item.textContent.trim() === label)
  assert.ok(found, `Missing button: ${label}`)
  return found
}

// The root fixture answers only the reviewed local bridge routes. Any metadata
// lookup or provider request is recorded and fails the route allowlist below.
async function mountedApp(check, { open, start } = {}) {
  const originalFetch = globalThis.fetch
  const originalOpen = window.open
  const originalMatchMedia = window.matchMedia
  window.matchMedia = () => ({ matches: true })
  window.open = open || (() => assert.fail('Unexpected provider consent popup'))
  const calls = []
  const instance = readyInstance()
  const inventory = {
    railway_access: 'available', dashboard_url: dashboard,
    connection: { connected: true, account: 'first@example.test' }, instances: [instance],
  }
  const identity = {
    account_mode: 'linked', account_unavailable: false, instance_id: null, member_since: null,
    profile: {
      user_id: 'user_test', email: 'owner@example.test', display_name: 'Test',
      handle: 'test_owner', avatar_url: null,
    },
    deployments: [{
      id: 'mob_test', name: instance.name, status: 'ready', url: instance.url, current: true,
    }],
  }
  const json = body => new Response(JSON.stringify(body))
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET'
    calls.push({ url, method, body: options.body })
    if (url === '/api/identity' && method === 'GET') return json(identity)
    if (url === '/api/identity/railway?dashboard=1' && method === 'GET') return json(inventory)
    if (url === '/api/identity/railway/deployments/mob_test/metrics?cost=1' && method === 'GET') return json(metrics)
    if (url === '/api/identity/agent' && method === 'GET') {
      return json({ agent_access: 'unavailable', models: [], balance: {}, trial: {}, retention: {} })
    }
    if (url === '/api/auth/providers/mobius/enabled' && method === 'GET') return json({ enabled: true })
    if (url === '/api/identity/railway/deployments/mob_test' && method === 'PATCH') {
      instance.name = JSON.parse(options.body).name
      return json(instance)
    }
    if (url === '/api/identity/railway/connect/start' && method === 'POST' && start) return start()
    assert.fail(`Unexpected bridge or provider request: ${method} ${url}`)
  }
  const root = createRoot(document.getElementById('root'))
  try {
    await act(async () => root.render(React.createElement(App, { appId: 'test', token: 'test' })))
    assert.ok(document.querySelector('.id-deployment-resources'), 'Root must load inventory')
    await check({ calls, inventory })
    const allowed = new Set([
      'GET /api/identity', 'GET /api/identity/railway?dashboard=1',
      'GET /api/identity/railway/deployments/mob_test/metrics?cost=1',
      'GET /api/identity/agent', 'GET /api/auth/providers/mobius/enabled',
      'PATCH /api/identity/railway/deployments/mob_test',
      'POST /api/identity/railway/connect/start',
    ])
    for (const call of calls) assert.ok(allowed.has(`${call.method} ${call.url}`), `Unexpected request: ${call.url}`)
  } finally {
    await act(async () => root.unmount())
    globalThis.fetch = originalFetch
    window.open = originalOpen
    window.matchMedia = originalMatchMedia
  }
}

test('the app root loads inventory and usage, renames locally, and never fetches creation metadata', async () => {
  await mountedApp(async ({ calls }) => {
    assert.match(document.querySelector('.id-metrics').textContent, /0\.1 vCPU/)
    assert.match(document.querySelector('.id-cost-summary').textContent, /\$1\.20 estimated usage/)
    assert.ok(document.querySelector(`a[href="${dashboard}"]`))
    await act(async () => document.querySelector('button[aria-label="Rename Test deployment"]').click())
    const input = document.querySelector('input[aria-label="Deployment name"]')
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Renamed deployment')
      input.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
    await act(async () => button('Save').click())
    assert.equal(document.querySelector('.id-deploy-name').textContent, 'Renamed deployment')
    assert.deepEqual(calls.filter(call => call.method !== 'GET'), [{
      url: '/api/identity/railway/deployments/mob_test', method: 'PATCH',
      body: JSON.stringify({ name: 'Renamed deployment' }),
    }])
    assert.ok(calls.filter(call => call.url === '/api/identity/railway?dashboard=1').length >= 2)
  })
})

async function openAccountDialog() {
  await act(async () => button('Account').click())
  return document.querySelector('[role="dialog"]')
}

test('a blocked account replacement popup shows the parent error and leaves controls usable', async () => {
  await mountedApp(async ({ calls }) => {
    const dialog = await openAccountDialog()
    await act(async () => button('Change hosting account', dialog).click())
    assert.match(dialog.querySelector('[role="alert"]').textContent, /browser blocked/)
    assert.equal(button('Change hosting account', dialog).disabled, false)
    assert.equal(button('Close', dialog).disabled, false)
    assert.equal(calls.filter(call => call.method !== 'GET').length, 0)
  }, { open: () => null })
})

test('account replacement busy state and start failure are owned by the app parent', async () => {
  let finishStart
  let closed = false
  const popup = { close: () => { closed = true }, location: { replace: () => assert.fail('Failed start must not navigate') } }
  await mountedApp(async ({ calls }) => {
    const dialog = await openAccountDialog()
    await act(async () => button('Change hosting account', dialog).click())
    assert.equal(dialog.getAttribute('aria-busy'), 'true')
    assert.equal(button('Connecting…', dialog).disabled, true)
    assert.equal(button('Close', dialog).disabled, true)
    await act(async () => dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    assert.equal(document.querySelector('[role="dialog"]'), dialog)
    await act(async () => finishStart(new Response(JSON.stringify({ detail: 'Consent service unavailable.' }), { status: 503 })))
    assert.match(dialog.querySelector('[role="alert"]').textContent, /Consent service unavailable/)
    assert.equal(dialog.getAttribute('aria-busy'), 'false')
    assert.equal(button('Change hosting account', dialog).disabled, false)
    assert.equal(button('Close', dialog).disabled, false)
    assert.equal(closed, true)
    assert.deepEqual(calls.filter(call => call.method !== 'GET'), [{
      url: '/api/identity/railway/connect/start', method: 'POST', body: JSON.stringify({ replace: true }),
    }])
  }, { open: () => popup, start: () => new Promise(resolve => { finishStart = resolve }) })
})

test('closing Railway consent with the unchanged account reports failure instead of replacement success', async t => {
  const navigations = []
  const popup = { closed: false, close() { this.closed = true }, location: { replace: url => navigations.push(url) } }
  await mountedApp(async ({ calls }) => {
    const dialog = await openAccountDialog()
    t.mock.timers.enable({ apis: ['setTimeout'] })
    try {
      await act(async () => button('Change hosting account', dialog).click())
      assert.deepEqual(navigations, ['https://railway.com/oauth/authorize'])
      assert.equal(button('Connecting…', dialog).disabled, true)
      popup.closed = true
      await act(async () => t.mock.timers.tick(900))
      assert.match(dialog.querySelector('[role="alert"]').textContent, /returned the same account/)
      assert.equal(button('Change hosting account', dialog).disabled, false)
      assert.equal(document.querySelector('[role="dialog"]'), dialog)
      assert.ok(calls.filter(call => call.url === '/api/identity/railway?dashboard=1').length >= 2)
      assert.equal(calls.filter(call => call.method === 'POST').length, 1)
    } finally {
      t.mock.timers.reset()
    }
  }, {
    open: () => popup,
    start: () => new Response(JSON.stringify({ authorization_url: 'https://railway.com/oauth/authorize' })),
  })
})

test('account replacement succeeds only after inventory confirms the new account, without creation metadata', async t => {
  const popup = { closed: false, close() { this.closed = true }, location: { replace: () => {} } }
  await mountedApp(async ({ calls, inventory }) => {
    const dialog = await openAccountDialog()
    t.mock.timers.enable({ apis: ['setTimeout'] })
    try {
      await act(async () => button('Change hosting account', dialog).click())
      assert.equal(button('Connecting…', dialog).disabled, true)
      inventory.connection.account = 'second@example.test'
      popup.closed = true
      await act(async () => t.mock.timers.tick(900))
      assert.equal(button('Change hosting account', dialog).disabled, false)
      assert.equal(dialog.querySelector('[role="alert"]'), null)
      assert.match(dialog.textContent, /second@example\.test/)
      assert.ok(calls.filter(call => call.url === '/api/identity/railway?dashboard=1').length >= 2)
      assert.deepEqual(calls.filter(call => call.method !== 'GET'), [{
        url: '/api/identity/railway/connect/start', method: 'POST', body: JSON.stringify({ replace: true }),
      }])
    } finally {
      t.mock.timers.reset()
    }
  }, {
    open: () => popup,
    start: () => new Response(JSON.stringify({ authorization_url: 'https://railway.com/oauth/authorize' })),
  })
})
