import assert from 'node:assert/strict'
import test from 'node:test'

import { trackFunnelEvent, trackPage } from './analytics'

const originalWindow = globalThis.window

function setWindowForTest(value: Window): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value,
  })
}

test.afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  })
})

test('trackFunnelEvent does not throw when localStorage access fails', () => {
  const dataLayer: unknown[] = []

  setWindowForTest({
    dataLayer,
    location: {
      href: 'https://example.com/input',
      pathname: '/input',
    } as unknown as Location,
    localStorage: {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    } as unknown as Storage,
  } as unknown as Window)

  assert.doesNotThrow(() => {
    trackFunnelEvent('start_analysis')
  })

  assert.equal(dataLayer.length, 1)
})

test('trackPage queues page_view when gtag is not ready yet', () => {
  const dataLayer: unknown[] = []

  setWindowForTest({
    dataLayer,
    location: {
      href: 'https://example.com/result',
      pathname: '/result',
    } as unknown as Location,
    localStorage: {
      getItem() {
        return null
      },
      setItem() {},
    } as unknown as Storage,
  } as unknown as Window)

  trackPage('/result', 'Result')

  assert.equal(dataLayer.length, 1)
  assert.deepEqual(dataLayer[0], [
    'event',
    'page_view',
    {
      page_path: '/result',
      page_title: 'Result',
      page_location: 'https://example.com/result',
    },
  ])
})
