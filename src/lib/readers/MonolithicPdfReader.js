const fs = require('fs')
const path = require('path')
import EmailHeaderScanner from '../utils/EmailHeaderScanner'
const ensureDirectoryExists = require('../utils/Filesystem').ensureDirectoryExists
import PDFUtils from '../utils/PDFUtils'

let MonolithicPdfReader = function (params) {
  let _options = {
    // FIXME: our multipage PDF parsing currently requires that each message start a new page;
    // if you set this to false, you'll get some bad results; it's here for future extensibility
    // (although I have no idea how to properly parse a "run-on" multi-email PDF)
    newPageForEachMessage: true,
    // some email PDF dumps have a "masthead" line at the top of the page, with somebody's name in it
    numNonHeadersAllowedAtTop: 1,
    // some email PDF dumps have slight variation in the y-position of the components of the header, e.g. "To:" and "foo@example.com"; this is usually between 0.01 and 0.25 mm
    yPosTolerance: 0.5,
    // convert image-based PDF to text before parsing, using pdftotext; currently, the caller has to indicate whether to
    // perform this OCR; if the PDF is not image based and performOCR is true, you will get bad results.  If the PDF
    // is image based, and performOCR is false, you won't get any results
    performOCR: false,
    verbose: true,
    src: ''
  }

  Object.assign(_options, params)

  let _emails = []
  let _onParseComplete = null
  let _onParseFail = null
  let _numHeadersSeenOnPage = 0
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

  if (!_options.src) {
    throw new Error('Error: you must specify params.src.')
  }

  if (!fs.existsSync(_options.src)) {
    throw new Error(`Error: src file ${_options.src} does not exist.`)
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
      log('EMAIL START: ', scanResult[1], scanResult[2])

      let end = scanResult[1]
      let start = scanResult[1]
      let headers = scanResult[2]

      if (_options.newPageForEachMessage) {
        end = {
          page: scanResult[1].page - 1
        }
        start = {
          page: scanResult[1].page
        }
      }

      // add an "end" to the previous email
      if (_emails.length > 0) {
        _emails[_emails.length - 1].end = end
      }

      // add a new email to the list
      _emails.push({
        file: _options.src,
        start: start,
        headers: headers
      })

      if (_options.newPageForEachMessage) {
        _ignoreHeadersUntilNextPage = true
      }
    }

    if (scanResult[0] === 'header') {
      _numHeadersSeenOnPage++
    } else {
      _numNonHeadersSeenOnPage++

      if (_options.newPageForEachMessage) {
        if ((_numHeadersSeenOnPage === 0) && (_options.numNonHeadersAllowedAtTop < _numNonHeadersSeenOnPage)) {
          return
        }
        _ignoreHeadersUntilNextPage = true
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

    if (_options.newPageForEachMessage) {
      _ehs.reset()
    }

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
    _numHeadersSeenOnPage = 0
    _numNonHeadersSeenOnPage = 0
    _ignoreHeadersUntilNextPage = false
  }

  function finishParsing () {
    if (_emails.length > 0) {
      _emails[_emails.length - 1].end = {
        page: _currPage
      }
    }
    _onParseComplete(_emails)
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

  this.read = function () {
    _emails = []

    let p = new Promise(function (resolve, reject) {
      _onParseComplete = resolve
      _onParseFail = reject
    })

    console.log('[MonolithicPdfReader]] reading ' + _options.src)

    if (_options.performOCR) {
      let pi = path.parse(_options.src)
      _pdf.ocr(_options.src, path.join(_ocrDir, pi.name))
      _options.src = path.join(_ocrDir, pi.base)
      console.log('[parseNext] parsing ' + _options.src)
    }

    _pdf.toText(_options.src, onPdfItem)

    return p
  }
}

// module.exports = MonolithicPdfReader
export default MonolithicPdfReader
