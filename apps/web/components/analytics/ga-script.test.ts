import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveGaScriptTags } from './ga-script'

test('resolveGaScriptTags returns null when NEXT_PUBLIC_GA_MEASUREMENT_ID is missing', () => {
  assert.equal(resolveGaScriptTags({}), null)
  assert.equal(resolveGaScriptTags({ NEXT_PUBLIC_GA_MEASUREMENT_ID: '   ' }), null)
})

test('resolveGaScriptTags builds script tags from trimmed measurement id', () => {
  const tags = resolveGaScriptTags({
    NEXT_PUBLIC_GA_MEASUREMENT_ID: '  G-TEST1234  ',
  })

  assert.deepEqual(tags, {
    src: 'https://www.googletagmanager.com/gtag/js?id=G-TEST1234',
    initScript: [
      'window.dataLayer = window.dataLayer || [];',
      'function gtag(){dataLayer.push(arguments);}',
      'gtag("js", new Date());',
      'gtag("config", "G-TEST1234", { send_page_view: false });',
    ].join('\n'),
  })
})
