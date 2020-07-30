# events.on

Ponyfill for events.on for Node.js 10.x.
Use Node.js core implementation if available.
See [Node.js own docs](
https://nodejs.org/dist/latest-v12.x/docs/api/events.html#events_events_on_emitter_eventname)
for more details.

## Install

```
npm i events.on
```

## Example

```js
const on = require('events.on')

const ee = new EventEmitter()
process.nextTick(() => {
  ee.emit('foo', 'bar')
  // 'bar' is a spurious event, we are testing
  // that it does not show up in the iterable
  ee.emit('bar', 24)
  ee.emit('foo', 42)
})

const iterable = on(ee, 'foo')

for await (const event of iterable) {
  console.log(event)

  // this loop never ends, to end you need to break
  // break
}
```

## License

MIT
