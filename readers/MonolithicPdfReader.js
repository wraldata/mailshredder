const pr = require('pdfreader')
const EmailHeaderScanner = require('../utils/EmailHeaderScanner')

let MonolithicPdfReader = function (params) {
  let _options = {
    newPageForEachMessage: true,
    verbose: false
  }

  let _src = ''
  let _emails = []
  let _onParseComplete = null
  let _ignoreHeadersUntilNextPage = false
  let _currPage = 0
  let _currLine = {
    page: -1,
    x: -1,
    y: -1,
    text: ''
  }

  let _ehs = new EmailHeaderScanner()

  if (typeof params.src !== 'undefined') {
    _src = params.src
  }

  if (!_src) {
    throw new Error('Error: you must specify params.src.')
  }

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
        start: start,
        headers: headers
      })

      if (_options.newPageForEachMessage) {
        _ignoreHeadersUntilNextPage = true
      }
    }

    if (scanResult[0] !== 'header') {
      if (_options.newPageForEachMessage) {
        _ignoreHeadersUntilNextPage = true
      }
    }
  }

  function processText (item) {
    if (item.y > _currLine.y) {
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
      file: _src,
      page: _currPage,
      x: -1,
      y: -1,
      text: ''
    }
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

  function onPdfReaderItem (err, item) {
    if (err) {
      // callback(err)
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
    })

    new pr.PdfReader().parseFileItems(_src, onPdfReaderItem)

    return p
  }
}

module.exports = MonolithicPdfReader
