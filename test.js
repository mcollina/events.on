'use strict'

const { EventTarget } = require('event-target-shim')
const test = require('tape')
const events = require('events')
const { EventEmitter } = events
const allSettled = require('promise.allsettled')

function build (test, on) {
  test('basic', async function ({ is, deepEqual }) {
    const ee = new EventEmitter()
    process.nextTick(() => {
      ee.emit('foo', 'bar')
      // 'bar' is a spurious event, we are testing
      // that it does not show up in the iterable
      ee.emit('bar', 24)
      ee.emit('foo', 42)
    })

    const iterable = on(ee, 'foo')

    const expected = [['bar'], [42]]

    for await (const event of iterable) {
      const current = expected.shift()

      deepEqual(current, event)

      if (expected.length === 0) {
        break
      }
    }
    is(ee.listenerCount('foo'), 0)
    is(ee.listenerCount('error'), 0)
  })

  test('error', async function ({ is }) {
    const ee = new EventEmitter()
    const _err = new Error('kaboom')
    process.nextTick(() => {
      ee.emit('error', _err)
    })

    const iterable = on(ee, 'foo')
    let looped = false
    let thrown = false

    try {
      // eslint-disable-next-line no-unused-vars
      for await (const event of iterable) {
        looped = true
      }
    } catch (err) {
      thrown = true
      is(err, _err)
    }
    is(thrown, true)
    is(looped, false)
  })

  test('errorDelayed', async function ({ is, deepEqual }) {
    const ee = new EventEmitter()
    const _err = new Error('kaboom')
    process.nextTick(() => {
      ee.emit('foo', 42)
      ee.emit('error', _err)
    })

    const iterable = on(ee, 'foo')
    const expected = [[42]]
    let thrown = false

    try {
      for await (const event of iterable) {
        const current = expected.shift()
        deepEqual(current, event)
      }
    } catch (err) {
      thrown = true
      is(err, _err)
    }
    is(thrown, true)
    is(ee.listenerCount('foo'), 0)
    is(ee.listenerCount('error'), 0)
  })

  test('throwInLoop', async function ({ is, deepEqual }) {
    const ee = new EventEmitter()
    const _err = new Error('kaboom')

    process.nextTick(() => {
      ee.emit('foo', 42)
    })

    try {
      for await (const event of on(ee, 'foo')) {
        deepEqual(event, [42])
        throw _err
      }
    } catch (err) {
      is(err, _err)
    }

    is(ee.listenerCount('foo'), 0)
    is(ee.listenerCount('error'), 0)
  })

  test('next', async function ({ deepEqual }) {
    const ee = new EventEmitter()
    const iterable = on(ee, 'foo')

    process.nextTick(function () {
      ee.emit('foo', 'bar')
      ee.emit('foo', 42)
      iterable.return()
    })

    const results = await Promise.all([
      iterable.next(),
      iterable.next(),
      iterable.next()
    ])

    deepEqual(results, [{
      value: ['bar'],
      done: false
    }, {
      value: [42],
      done: false
    }, {
      value: undefined,
      done: true
    }])

    deepEqual(await iterable.next(), {
      value: undefined,
      done: true
    })
  })

  test('nextError', async function ({ is, deepEqual }) {
    const ee = new EventEmitter()
    const iterable = on(ee, 'foo')
    const _err = new Error('kaboom')
    process.nextTick(function () {
      ee.emit('error', _err)
    })
    const results = await allSettled([
      iterable.next(),
      iterable.next(),
      iterable.next()
    ])
    deepEqual(results, [{
      status: 'rejected',
      reason: _err
    }, {
      status: 'fulfilled',
      value: {
        value: undefined,
        done: true
      }
    }, {
      status: 'fulfilled',
      value: {
        value: undefined,
        done: true
      }
    }])
    is(ee.listeners('error').length, 0)
  })

  test('iterableThrow', async function ({ is, deepEqual, throws }) {
    const ee = new EventEmitter()
    const iterable = on(ee, 'foo')

    process.nextTick(() => {
      ee.emit('foo', 'bar')
      ee.emit('foo', 42) // lost in the queue
      iterable.throw(_err)
    })

    const _err = new Error('kaboom')
    let thrown = false

    throws(() => {
      // No argument
      iterable.throw()
    }, {
      message: 'The "EventEmitter.AsyncIterator" property must be' +
      ' an instance of Error. Received undefined',
      name: 'TypeError'
    })

    const expected = [['bar'], [42]]

    try {
      for await (const event of iterable) {
        deepEqual(event, expected.shift())
      }
    } catch (err) {
      thrown = true
      is(err, _err)
    }

    is(thrown, true)
    is(expected.length, 0)
    is(ee.listenerCount('foo'), 0)
    is(ee.listenerCount('error'), 0)
  })

  test('errorListenerCount', async function ({ is }) {
    const et = new EventEmitter()
    on(et, 'foo')
    is(et.listenerCount('error'), 1)
  })
}

test('>>> ponyfill', ({ test }) => {
  const on = require('./ponyfill')

  build(test, on)

  test('eventTarget', async function ({ is }) {
    const et = new EventTarget()
    const tick = () => et.dispatchEvent({ type: 'tick' })
    const interval = setInterval(tick, 0)
    let count = 0
    for await (const [event] of on(et, 'tick')) {
      count++
      is(event.type, 'tick')
      if (count >= 5) {
        break
      }
    }
    is(count, 5)
    clearInterval(interval)
  })

  test('nodeEventTarget', async function ({ is }) {
    const et = new EventTarget()
    const tick = () => et.dispatchEvent({ type: 'tick' })
    const interval = setInterval(tick, 0)
    let count = 0
    for await (const [event] of on(et, 'tick')) {
      count++
      is(event.type, 'tick')
      if (count >= 5) {
        break
      }
    }
    is(count, 5)
    clearInterval(interval)
  })
})

test('module is exported', async function ({ ok }) {
  const on = require('./index')
  ok(typeof on === 'function')
})

if (events.on) {
  test('>>> core', ({ test }) => {
    build(test, events.on)
  })
}
