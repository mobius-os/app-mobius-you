import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

const dom = new JSDOM('<!doctype html><body><button id="opener">Open</button><div id="root"></div></body>', { url: 'https://example.test' })
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document,
  CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true,
})
const { createRoot } = await import('react-dom/client')

// Bundle the real entry, exposing its dialog components only in the test copy.
const source = await readFile(new URL('./index.jsx', import.meta.url), 'utf8')
const output = await build({
  stdin: {
    contents: source + '\nexport { identityRequest, NewDeploymentModal, DeleteDeploymentModal, RailwayConnectionModal, AccountConfirmNotice }',
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

const { identityRequest, NewDeploymentModal, DeleteDeploymentModal, RailwayConnectionModal, AccountConfirmNotice } = components
const request = () => identityRequest('test', '/railway/deployments/test', { method: 'DELETE' })
const cases = [
  { name: 'delete', component: DeleteDeploymentModal, props: {
    instance: { id: 'test', name: 'Test', status: 'ready' }, onDelete: request,
  }, buttons: ['Delete deployment', 'Delete permanently'] },
  { name: 'create', component: NewDeploymentModal, props: {
    workspacePlans: { workspaces: [{ id: 'test', name: 'Test', plan: 'hobby' }] }, onCreate: request,
  }, submit: true },
  { name: 'disconnect', component: RailwayConnectionModal, props: {
    token: 'test', connection: { account: 'Test' }, onDisconnected: () => assert.fail('must not disconnect'),
  }, buttons: ['Disconnect', 'Disconnect Railway'] },
]

for (const scenario of cases) {
  for (const detail of [
    { code: 'confirm_on_account', message: 'Finish on the account dashboard.', confirm_url: 'https://mobius.you/dashboard' },
    'Service temporarily unavailable.',
    { code: 'confirm_on_account', message: 'Invalid dashboard address.', confirm_url: 'javascript:alert(1)' },
  ]) {
    test(`${scenario.name} keeps ${typeof detail === 'string' ? 'plain errors' : detail.confirm_url.startsWith('https:') ? 'the account handoff keyboard-accessible' : 'invalid links out'} inside its dialog`, async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = async () => new Response(JSON.stringify({ detail }), { status: 409 })
      const opener = document.getElementById('opener')
      opener.focus()
      const root = createRoot(document.getElementById('root'))
      let closed = false
      try {
        await act(async () => {
          root.render(React.createElement(React.Fragment, null,
            React.createElement(AccountConfirmNotice),
            React.createElement(scenario.component, { ...scenario.props, onClose: () => { closed = true } }),
          ))
        })
        const dialog = document.querySelector('[role="dialog"]')
        await act(async () => {
          if (scenario.submit) {
            dialog.querySelector('button[type="submit"]').click()
          } else {
            const button = [...dialog.querySelectorAll('button')].find(item => item.textContent.trim() === scenario.buttons[0])
            assert.ok(button)
            button.click()
          }
        })
        if (!scenario.submit) {
          await act(async () => {
            const button = [...dialog.querySelectorAll('button')].find(item => item.textContent.trim() === scenario.buttons[1])
            assert.ok(button)
            button.click()
          })
        }
        assert.equal(closed, false)
        assert.match(dialog.querySelector('[role="alert"]').textContent, new RegExp(typeof detail === 'string' ? detail : detail.message))
        const link = dialog.querySelector('a[href="https://mobius.you/dashboard"]')
        const expectedLink = typeof detail !== 'string' && detail.confirm_url.startsWith('https:')
        assert.equal(Boolean(link), expectedLink)
        if (link) {
          assert.equal(link.target, '_blank')
          assert.equal(link.rel, 'noopener noreferrer')
          link.focus()
          assert.equal(document.activeElement, link)
          const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')]
          assert.ok(focusable.includes(link))
          focusable.at(-1).focus()
          document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
          assert.equal(document.activeElement, focusable[0])
          document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))
          assert.equal(document.activeElement, focusable.at(-1))
        }
      } finally {
        await act(async () => root.unmount())
        globalThis.fetch = originalFetch
      }
      assert.equal(document.activeElement, opener)
    })
  }
}
