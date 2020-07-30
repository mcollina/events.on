'use strict'

const { on } = require('events')

module.events = on || require('./ponyfill')
