const fs = require('fs')
const path = require('path')
import EmailHeaderScanner from '../utils/EmailHeaderScanner'
const ensureDirectoryExists = require('../utils/Filesystem').ensureDirectoryExists
import PDFUtils from '../utils/PDFUtils'

let MultiplePdfReader = function (params) {
  let _options = {
    // some email PDF dumps have a "masthead" line at the top of the page, with somebody's name in it
    numNonHeadersAllowedAtTop: 1,
    // some email PDF dumps have slight variation in the y-position of the components of the header, e.g. "To:" and "foo@example.com"; this is usually between 0.01 and 0.25 mm
    yPosTolerance: 0.5,
    verbose: true,
    outDir: '/tmp',
    performOCR: false,
    src: ''
  }

  Object.assign(_options, params)

  let _emails = []
  let _onParseComplete = null
  let _onParseFail = null
  let _numNonHeadersSeenOnPage = 0
  let _ignoreHeadersUntilNextPage = false
  let _currPage = 0
  let _currLine = {
    page: -1,
    x: -1,
    y: -1,
    text: ''
  }
  let _ocrDir = ''

  let _files = []
  let _currIdx = 0

  if (!_options.src) {
    throw new Error('Error: you must specify params.src.')
  }

  if (!fs.existsSync(_options.src)) {
    throw new Error(`Error: src directory ${_options.src} does not exist.`)
  }

  if (_options.performOCR) {
    _ocrDir = path.join(_options.outDir, 'ocr')
    ensureDirectoryExists(_ocrDir)
  }

  let _ehs = new EmailHeaderScanner()
  let _pdf = new PDFUtils()

  function log (msg) {
    if (!_options.verbose) {
      return
    }
    console.log(msg)
  }

  function processLine (line) {
    if (line.text === '') {
      return
    }

    log(`[[${line.x}, ${line.y}]] ${line.text}`)

    if (_ignoreHeadersUntilNextPage) {
      return
    }

    let scanResult = _ehs.scanLine(line)
    log('SCAN RESULT: ' + scanResult[0])

    if (scanResult[0] === 'email_start') {
      log('EMAIL START: ', scanResult[1])

      let end = scanResult[1]
      let start = scanResult[1]
      let headers = scanResult[2]

      end = {
        page: scanResult[1].page - 1
      }
      start = {
        page: scanResult[1].page
      }

      // add an "end" to the previous email
      if (_emails.length > 0) {
        _emails[_emails.length - 1].end = end
      }

      // add a new email to the list
      _emails.push({
        file: _files[_currIdx],
        start: start,
        headers: headers
      })

      _ignoreHeadersUntilNextPage = true
    }

    if (scanResult[0] !== 'header') {
      _numNonHeadersSeenOnPage++

      if (_options.newPageForEachMessage) {
        if (_options.numNonHeadersAllowedAtTop < _numNonHeadersSeenOnPage) {
          _ignoreHeadersUntilNextPage = true
        }
      }
    }
  }

  function processText (item) {
    let delta = Math.abs(item.y - _currLine.y)

    if (delta > _options.yPosTolerance) {
      processLine(_currLine)
      _currLine.x = item.x
      _currLine.y = item.y
      _currLine.text = item.text
    } else {
      _currLine.text += ' ' + item.text
    }
  }

  function processPage (item) {
    processLine(_currLine)

    _ehs.reset()

    _currPage++
    log('--------------------------------------------------------------------------------')
    log('PAGE ' + item.page)
    _currLine = {
      file: _options.src,
      page: _currPage,
      x: -1,
      y: -1,
      text: ''
    }

    _numNonHeadersSeenOnPage = 0
    _ignoreHeadersUntilNextPage = false
  }

  function finishParsing () {
    if (_emails.length > 0) {
      _emails[_emails.length - 1].end = {
        page: _currPage
      }
    }
    _currIdx++
    parseNext(_emails)
  }

  function onPdfItem (err, item) {
    if (err) {
      _onParseFail(err.data)
    } else if (!item) {
      finishParsing()
    } else if (item.page) {
      processPage(item)
    } else if (item.text) {
      processText(item)
    }
  }

  function parseNext () {
    if (_currIdx > _files.length - 1) {
      _onParseComplete(_emails)
      return
    }

    if (_options.performOCR) {
      let pi = path.parse(_files[_currIdx])
      _pdf.ocr(_files[_currIdx], path.join(_ocrDir, pi.name))
      _files[_currIdx] = path.join(_ocrDir, pi.base)
      console.log('[parseNext] parsing ' + _files[_currIdx])
    }

    _currPage = 0
    _pdf.toText(_files[_currIdx], onPdfItem)
  }

  this.read = function () {
    _emails = []

    let p = new Promise(function (resolve, reject) {
      _onParseComplete = resolve
      _onParseFail = reject
    })

    console.log('[MultiplePdfReader]] reading ' + _options.src)

    fs.readdir(_options.src, function (err, items) {
      if (err) {
        throw new Error(`Error reading ${_options.src}: ${err.message}`)
      }

      _files = []
      for (let i = 0; i < items.length; i++) {
        if (!items[i].match(/\.pdf$/)) {
          continue
        }
        _files.push(path.join(_options.src, items[i]))
      }

      _currIdx = 0
      parseNext.call(this)
    })

    return p
  }
}

// module.exports = MultiplePdfReader
export default MultiplePdfReader
