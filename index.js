'use strict'

const { on } = require('events')

module.exports = on || require('./ponyfill')
