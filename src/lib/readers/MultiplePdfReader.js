const fs = require('fs')
const path = require('path')
import EmailHeaderScanner from '../utils/EmailHeaderScanner'
const ensureDirectoryExists = require('../utils/Filesystem').ensureDirectoryExists
import PDFUtils from '../utils/PDFUtils'
import Logger from '../utils/Logger'

let MultiplePdfReader = function (params) {
  let _options = {
    // some email PDF dumps have a "masthead" line at the top of the page, with somebody's name in it
    numNonHeadersAllowedAtTop: 1,
    // some email PDF dumps have slight variation in the y-position of the components of the header, e.g. "To:" and "foo@example.com"; this is usually between 0.01 and 0.25 mm
    yPosTolerance: 0.5,
    verbose: true,
    outDir: '/tmp',
    performOCR: false,
    unpackPortfolio: false,
    src: ''
  }

  let _logger = Logger.getLogger()

  Object.assign(_options, params)

  let _emails = []
  let _onParseComplete = null
  let _onParseFail = null
  let _numHeadersSeenOnPage = 0
  let _numNonHeadersSeenOnPage = 0
  let _ignoreHeaders = false
  let _currPage = 0
  let _currLine = {
    page: -1,
    x: -1,
    y: -1,
    text: ''
  }
  let _ocrDir = ''
  let _unpackDir = ''

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

  if (_options.unpackPortfolio) {
    _unpackDir = path.join(_options.outDir, 'unpack')
    ensureDirectoryExists(_unpackDir)
  }

  let _ehs = new EmailHeaderScanner()
  let _pdf = new PDFUtils()

  function processLine (line) {
    if (line.text === '') {
      return
    }

    _logger.debug(`[[${line.x}, ${line.y}]] ${line.text}`)

    if (_ignoreHeaders) {
      return
    }

    let scanResult = _ehs.scanLine(line)
    _logger.debug('SCAN RESULT: ' + scanResult[0])

    if (scanResult[0] === 'email_start') {
      _logger.debug('EMAIL START: ', scanResult[1])

      let start = {
        file: _files[_currIdx],
        page: scanResult[1].page
      }

      let headers = scanResult[2]

      // add a new email to the list
      _emails.push({
        file: _files[_currIdx],
        start: start,
        headers: headers
      })

      _ignoreHeaders = true
    }

    if (scanResult[0] === 'header') {
      _numHeadersSeenOnPage++
    } else {
      _numNonHeadersSeenOnPage++

      if ((_numHeadersSeenOnPage === 0) && (_options.numNonHeadersAllowedAtTop <= _numNonHeadersSeenOnPage)) {
        return
      }
      _ignoreHeaders = true
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
    _logger.debug('--------------------------------------------------------------------------------')
    _logger.debug('PAGE ' + item.page)
    _currLine = {
      file: _files[_currIdx],
      page: _currPage,
      x: -1,
      y: -1,
      text: ''
    }

    _numHeadersSeenOnPage = 0
    _numNonHeadersSeenOnPage = 0
  }

  function finishParsing () {
    if (_emails.length > 0) {
      _emails[_emails.length - 1].end = {
        file: _files[_currIdx],
        page: _currPage
      }
    }
    _currIdx++
    parseNext()
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

    _ignoreHeaders = false
    _currPage = 0

    if (_options.performOCR) {
      let pi = path.parse(_files[_currIdx])
      _logger.debug('[parseNext] OCR-ing ' + _files[_currIdx])
      _pdf.ocr(_files[_currIdx], path.join(_ocrDir, pi.name), function () {
        _files[_currIdx] = path.join(_ocrDir, pi.base)
        _logger.debug('[parseNext] extracting text from ' + _files[_currIdx])
        _pdf.toText(_files[_currIdx], onPdfItem)
      })
    } else {
      _logger.debug('[parseNext] extracting text from ' + _files[_currIdx])
      _pdf.toText(_files[_currIdx], onPdfItem)
    }
  }

  this.read = function () {
    _emails = []

    let p = new Promise(function (resolve, reject) {
      _onParseComplete = resolve
      _onParseFail = reject
    })

    if (_options.unpackPortfolio) {
      _logger.debug('[MultiplePdfReader] unpacking ' + _options.src + ' to ' + _unpackDir)
      _pdf.unpackPortfolio(_options.src, _unpackDir, () => {
        _options.src = _unpackDir
        reallyRead()
      })
    } else {
      reallyRead()
    }

    function reallyRead () {
      _logger.debug('[MultiplePdfReader] reading ' + _options.src)

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
    }

    return p
  }
}

// module.exports = MultiplePdfReader
export default MultiplePdfReader
