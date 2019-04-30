const fs = require('fs')
const path = require('path')
const emlformat = require('eml-format')
import Logger from '../utils/Logger'
import PDFUtils from '../utils/PDFUtils'
const ensureDirectoryExists = require('../utils/Filesystem').ensureDirectoryExists

let MultipleEmlReader = function (params) {
  let _options = {
    outDir: '/tmp',
    src: ''
  }

  let _logger = Logger.getLogger()

  Object.assign(_options, params)

  let _emails = []
  let _onParseComplete = null
  let _onParseFail = null

  let _extractDir = ''

  let _files = []
  let _currIdx = 0

  let _pdf = new PDFUtils()

  if (!_options.src) {
    throw new Error('Error: you must specify params.src.')
  }

  if (!fs.existsSync(_options.src)) {
    throw new Error(`Error: src directory ${_options.src} does not exist.`)
  }

  _extractDir = path.join(_options.outDir, 'extract')
  ensureDirectoryExists(_extractDir)

  // extract what we deem the "important" headers and put them in the format that
  // our PDF reader classes use
  function getImportantHeaders (allHeaders) {
    let headers = {}

    let importantHeaders = [
      'From',
      'To',
      'Date',
      'Sent',
      'Subject',
      'Attachments'
    ]

    for (let i = 0; i < importantHeaders.length; i++) {
      let h = importantHeaders[i]
      if (typeof allHeaders[h] !== 'undefined') {
        // we HTML-encode the values, because our PDF parsing returns them with their entities escaped,
        // so the rest of the application expects them to be like that, so we'll just be consistent
        headers[h] = {
          header: h,
          value: encodeEntities(allHeaders[h])
        }
      }
    }

    return headers
  }

  function zeroFill (number, width) {
    width -= number.toString().length
    if (width > 0) {
      return new Array(width + (/\./.test(number) ? 2 : 1)).join('0') + number
    }
    return number + '' // always return a string
  }

  function encodeEntities (rawStr) {
    var encodedStr = rawStr.replace(/[\u00A0-\u9999<>&]/gim, function (i) {
      return '&#' + i.charCodeAt(0) + ';'
    })
    return encodedStr
  }

  function insertHeaders (html, headers) {
    let headerTable = `<style>
table.emailHeaders td {
  font-family: Arial, Helvetica Neue, Helvetica, sans-serif;
  font-size: 11pt;
}
</style>
<table class="emailHeaders">\n`
    for (var h in headers) {
      let cell1 = encodeEntities(headers[h].header)
      let cell2 = headers[h].value
      headerTable += `<tr><td valign="top"><strong>${cell1}:&nbsp;&nbsp;</strong></td><td valign="top">${cell2}</td></tr>\n`
    }
    headerTable += '</table><br /><br />\n'

    return html.replace(/(<body.*?>)/, '$1' + headerTable)
  }

  function extractFiles (emlFile, data) {
    // extract each email to a directory along with any attachments
    let pi = path.parse(emlFile)
    let emailDir = path.join(_extractDir, zeroFill(_currIdx, 6))
    ensureDirectoryExists(emailDir)

    _logger.debug('[MultipleEmlReader] extracting ' + _files[_currIdx] + ' to ' + emailDir)

    if (!data) {
      _logger.debug('[MultipleEmlReader] error parsing EML format for ' + _files[_currIdx])
      return ''
    }

    let fileBase = path.join(emailDir, pi.name)

    let inlineImages = {}

    if (typeof data['attachments'] !== 'undefined') {
      for (let i = 0; i < data['attachments'].length; i++) {
        let a = data['attachments'][i]
        if (!(a.data instanceof Uint8Array)) {
          continue
        }

        let attachmentFile = ''
        let matches = a.contentType.match(/name="(.+?)"/)
        if (matches) {
          let name = matches[1]
          _logger.debug('[MultipleEmlReader]   attachment: ' + name)
          attachmentFile = path.join(emailDir, name)
          fs.writeFileSync(attachmentFile, a.data)

          // inline images will look like this in the HTML: <img src="cid:image001.png@01D317F7.80BE1C20">
          // we need to replace those references in the HTML with the filename that we're extracting to
          if (a.inline && (typeof a.id !== 'undefined')) {
            let matches = a.id.match(/<(.+?)>/)
            if (matches) {
              let id = matches[1]
              let cid = 'cid:' + id
              _logger.debug('[MultipleEmlReader]     (cid = ' + cid + ')')
              inlineImages[cid] = name
            }
          }
        }
      }
    }

    let htmlFile = fileBase + '.html'
    let htmlData = ''
    if (typeof data['html'] !== 'undefined') {
      htmlData = data['html']

      if (!htmlData.match(/<html/)) {
        htmlData = `<html>\n<head>\n</head>\n<body>\n${htmlData}\n</body>\n</html>\n`
      }

      // fix the inline images, if any
      let cid = ''
      for (cid in inlineImages) {
        let imageFile = inlineImages[cid]
        htmlData = htmlData.split(cid).join(imageFile)
      }
    } else {
      let textData = ''
      if (typeof data['text'] !== 'undefined') {
        textData = data['text']
      }

      textData = textData.replace(/(?:\r\n|\r|\n)/g, '<br />\n')
      htmlData = `<html>\n<head>\n</head>\n<body>\n<div style="font-family: Courier New">${textData}</div>\n</body>\n</html>\n`
    }

    htmlData = insertHeaders(htmlData, data.headers)
    fs.writeFileSync(htmlFile, htmlData)
    return htmlFile
  }

  function parseNext () {
    if (_currIdx > _files.length - 1) {
      convertToPdf()
      return
    }

    var eml = fs.readFileSync(_files[_currIdx], 'utf-8')
    emlformat.read(eml, (error, data) => {
      if (error) {
        _onParseFail(error)
        return
      }

      data.headers = getImportantHeaders(data.headers)

      let file = extractFiles(_files[_currIdx], data)

      _emails.push({
        file: file,
        start: {
          file: _files[_currIdx],
          page: 1
        },
        end: {
          file: _files[_currIdx],
          page: 0
        },
        headers: data.headers
      })

      _currIdx++
      setTimeout(parseNext, 0)
    })
  }

  function convertNext () {
    if (_currIdx > _emails.length - 1) {
      _logger.debug('[MultipleEmlReader] done')
      _onParseComplete(_emails)
      return
    }

    let email = _emails[_currIdx]

    if (!email.file.match(/\.(html|txt)$/)) {
      _currIdx++
      setTimeout(convertNext, 0)
      return
    }

    let pi = path.parse(email.file)
    let pdfFile = path.join(_options.outDir, pi.name + '.pdf')
    _logger.debug('[MultipleEmlReader]  - ' + pdfFile)

    _pdf.htmlToPdf(email.file, pdfFile, (code) => {
      email.file = pdfFile
      email.end.page = _pdf.countPages(pdfFile)
      _currIdx++
      convertNext()
    })
  }

  function convertToPdf () {
    _logger.debug('[MultipleEmlReader] converting to pdf...')
    _currIdx = 0
    convertNext()
  }

  this.read = function () {
    _emails = []

    let p = new Promise(function (resolve, reject) {
      _onParseComplete = resolve
      _onParseFail = reject
    })

    _logger.debug('[MultipleEmlReader] reading ' + _options.src)

    fs.readdir(_options.src, function (err, items) {
      if (err) {
        throw new Error(`Error reading ${_options.src}: ${err.message}`)
      }

      _files = []
      for (let i = 0; i < items.length; i++) {
        if (!items[i].match(/\.eml$/)) {
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

// module.exports = MultipleEmlReader
export default MultipleEmlReader
