import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveDevProxyTarget } from '../vite.config.js'

test('uses configured dev proxy target for API requests', () => {
  assert.equal(
    resolveDevProxyTarget({
      VITE_DEV_PROXY_TARGET: 'http://localhost:3001/',
    }),
    'http://localhost:3001'
  )
})

test('keeps localhost:3000 as the default dev proxy target', () => {
  assert.equal(resolveDevProxyTarget({}), 'http://localhost:3000')
})
