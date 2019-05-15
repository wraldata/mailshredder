const fs = require('fs')
const path = require('path')
import EmailHeaderScanner from '../utils/EmailHeaderScanner'
const ensureDirectoryExists = require('../utils/Filesystem').ensureDirectoryExists
import PDFUtils from '../utils/PDFUtils'
import Logger from '../utils/Logger'

let MonolithicPdfReader = function (params) {
  let _options = {
    // some email PDF dumps have slight variation in the y-position of the components of the header, e.g. "To:" and "foo@example.com"; this is usually between 0.01 and 0.25 mm
    yPosTolerance: 0.5,
    headerJustification: 'left',
    // convert image-based PDF to text before parsing; currently, the caller has to indicate whether to
    // perform this OCR; if the PDF is not image based and performOCR is true, you will get bad results.  If the PDF
    // is image based, and performOCR is false, you won't get any results
    performOCR: false,
    verbose: true,
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
        file: _options.src,
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
        file: _options.src,
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
      file: _options.src,
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
    } else if (item.pageStart) {
      processPageStart(item)
    } else if (item.pageEnd) {
      processPageEnd(item)
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

    _logger.debug('[MonolithicPdfReader] reading ' + _options.src)

    if (_options.performOCR) {
      let pi = path.parse(_options.src)

      _logger.debug('[read] OCR-ing ' + _options.src)
      _pdf.ocr(_options.src, path.join(_ocrDir, pi.name), function () {
        _options.src = path.join(_ocrDir, pi.base)
        _logger.debug('[read] extracting text from ' + _options.src)
        _pdf.toText(_options.src, onPdfItem)
      })
    } else {
      _logger.debug('[read] extracting text from ' + _options.src)
      _pdf.toText(_options.src, onPdfItem)
    }

    return p
  }
}

// module.exports = MonolithicPdfReader
export default MonolithicPdfReader
