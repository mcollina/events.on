'use strict'

const AsyncIteratorPrototype = Object.getPrototypeOf(
  Object.getPrototypeOf(async function * () {}).prototype)

function createIterResult (value, done) {
  return { value, done }
}

function addErrorHandlerIfEventEmitter (emitter, handler, flags) {
  if (typeof emitter.on === 'function') {
    eventTargetAgnosticAddListener(emitter, 'error', handler, flags)
  }
}

function eventTargetAgnosticRemoveListener (emitter, name, listener, flags) {
  if (typeof emitter.removeListener === 'function') {
    emitter.removeListener(name, listener)
  } else if (typeof emitter.removeEventListener === 'function') {
    emitter.removeEventListener(name, listener, flags)
  } else {
    throw new ('emitter', 'EventEmitter', emitter)()
  }
}

function eventTargetAgnosticAddListener (emitter, name, listener, flags) {
  if (typeof emitter.on === 'function') {
    if (flags && flags.once) {
      emitter.once(name, listener)
    } else {
      emitter.on(name, listener)
    }
  } else if (typeof emitter.addEventListener === 'function') {
    // EventTarget does not have `error` event semantics like Node
    // EventEmitters, we do not listen to `error` events here.
    emitter.addEventListener(name, (arg) => { listener(arg) }, flags)
  } else {
    throw new TypeError('The "EventEmitter.AsyncIterator" property must be' +
    ' an instance of Error. Received undefined')
  }
}

function on (emitter, event) {
  const unconsumedEvents = []
  const unconsumedPromises = []
  let error = null
  let finished = false

  const iterator = Object.setPrototypeOf({
    next () {
      // First, we consume all unread events
      const value = unconsumedEvents.shift()
      if (value) {
        return Promise.resolve(createIterResult(value, false))
      }

      // Then we error, if an error happened
      // This happens one time if at all, because after 'error'
      // we stop listening
      if (error) {
        const p = Promise.reject(error)
        // Only the first element errors
        error = null
        return p
      }

      // If the iterator is finished, resolve to done
      if (finished) {
        return Promise.resolve(createIterResult(undefined, true))
      }

      // Wait until an event happens
      return new Promise(function (resolve, reject) {
        unconsumedPromises.push({ resolve, reject })
      })
    },

    return () {
      eventTargetAgnosticRemoveListener(emitter, event, eventHandler)
      eventTargetAgnosticRemoveListener(emitter, 'error', errorHandler)
      finished = true

      for (const promise of unconsumedPromises) {
        promise.resolve(createIterResult(undefined, true))
      }

      return Promise.resolve(createIterResult(undefined, true))
    },

    throw (err) {
      if (!err || !(err instanceof Error)) {
        throw new TypeError('The "EventEmitter.AsyncIterator" property must be' +
        ' an instance of Error. Received undefined')
      }
      error = err
      eventTargetAgnosticRemoveListener(emitter, event, eventHandler)
      eventTargetAgnosticRemoveListener(emitter, 'error', errorHandler)
    },

    [Symbol.AsyncIterator] () {
      return this
    }
  }, AsyncIteratorPrototype)

  eventTargetAgnosticAddListener(emitter, event, eventHandler)
  if (event !== 'error') {
    addErrorHandlerIfEventEmitter(emitter, errorHandler)
  }

  return iterator

  function eventHandler (...args) {
    const promise = unconsumedPromises.shift()
    if (promise) {
      promise.resolve(createIterResult(args, false))
    } else {
      unconsumedEvents.push(args)
    }
  }

  function errorHandler (err) {
    finished = true

    const toError = unconsumedPromises.shift()

    if (toError) {
      toError.reject(err)
    } else {
      // The next time we call next()
      error = err
    }

    iterator.return()
  }
}

module.exports = on
