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
    await mounted(Deployments,{token:'test',items:[],railway:{railway_access:'available',dashboard_url:dashboard,connection:{connected:true,account:'test'},instances:[instance]},workspacePlans:{workspaces:[]},plansSettled:true},async calls=>{
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
    await mounted(Deployments,{token:'test',items:[],railway:{railway_access,dashboard_url:dashboard,connection:null,instances:[]},plansSettled:true},async()=>{
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
