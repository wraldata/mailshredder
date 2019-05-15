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
    // some emails have multi-line headers where it is very difficult to identify the second line as a header; this causes us to bail out
    // of parsing the headers too early, and we never find all the important headers
    numNonHeadersAllowedBetweenHeaders: 1,
    // some email PDF dumps have slight variation in the y-position of the components of the header, e.g. "To:" and "foo@example.com"; this is usually between 0.01 and 0.25 mm
    yPosTolerance: 0.5,
    verbose: true,
    outDir: '/tmp',
    headerJustification: 'left',
    performOCR: false,
    unpackPortfolio: false,
    src: ''
  }

  let _logger = Logger.getLogger()

  Object.assign(_options, params)

  let _pageLines = []
  let _emails = []
  let _onParseComplete = null
  let _onParseFail = null
  let _currPage = 0
  let _currLine = {
    page: -1,
    x: -1,
    y: -1,
    items: [],
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

  function processPage () {
    for (let i = 0; i < _pageLines.length; i++) {
      let line = _pageLines[i]

      // note -- because we use ytolerance when assembling lines from individual text
      // items, the words for a given line might not be sorted in X; so we sort them now
      line.items.sort((a, b) => {
        return a.x - b.x
      })
      // and reassemble the text string with the ordered items
      let newText = ''
      for (let j = 0; j < line.items.length; j++) {
        let item = line.items[j]
        newText += item.text + ' '
      }
      line.text = newText.trim()

      _logger.debug(`[${line.x.toFixed(2)}, ${line.y.toFixed(2)}] ${line.text}`)
      for (let j = 0; j < line.items.length; j++) {
        let item = line.items[j]
        _logger.debug(`  <${item.x.toFixed(2)}, ${item.y.toFixed(2)}> ${item.text}`)
      }
    }

    let headers = _ehs.scanForHeaders(_pageLines, (_options.headerJustification === 'right'))
    if (headers) {
      _logger.debug('found email headers on page')
      _emails.push({
        file: _files[_currIdx],
        start: {
          page: _currPage
        },
        end: {
          page: _currPage
        },
        headers: headers
      })
    } else {
      if (_emails.length > 0) {
        _emails[_emails.length - 1].end.page = _currPage
      }
    }
  }

  function processText (item) {
    let delta = Math.abs(item.y - _currLine.y)

    if (delta > _options.yPosTolerance) {
      _pageLines.push(_currLine)
      _currLine = {
        file: _files[_currIdx],
        page: _currPage,
        x: item.x,
        y: item.y,
        items: [ item ],
        text: item.text
      }
    } else {
      _currLine.items.push(item)
      _currLine.text += ' ' + item.text
    }
  }

  function processPageEnd (item) {
    _pageLines.push(_currLine)

    processPage()
  }

  function processPageStart (item) {
    _currPage++
    _pageLines = []
    _logger.debug('--------------------------------------------------------------------------------')
    _logger.debug('PAGE ' + item.pageStart)
    _currLine = {
      file: _files[_currIdx],
      page: _currPage,
      x: -1,
      y: -1,
      items: [],
      text: ''
    }
  }

  function finishParsing () {
    if (_emails.length > 0) {
      _emails[_emails.length - 1].end = {
        file: _files[_currIdx],
        page: _currPage
      }
    }
    _currIdx++

    if (_currIdx > _files.length - 1) {
      _onParseComplete(_emails)
      return
    }

    setTimeout(parseNext, 0)
  }

  function onPdfItem (err, item) {
    if (err) {
      _onParseFail(err.data)
    } else if (!item) {
      finishParsing()
    } else if (item.pageStart) {
      processPageStart(item)
    } else if (item.pageEnd) {
      processPageEnd(item)
    } else if (item.text) {
      processText(item)
    }
  }

  function parseNext () {
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
