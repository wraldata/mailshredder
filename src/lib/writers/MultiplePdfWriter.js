const fs = require('fs')
const path = require('path')
import Logger from '../utils/Logger'
import PDFUtils from '../utils/PDFUtils'

const ensureDirectoryExists = require('../utils/Filesystem').ensureDirectoryExists

let MultiplePdfWriter = function (params) {
  let _options = {
    inputType: MultiplePdfWriter.INPUT_TYPE_SINGLE_FILE_PAGE_PER_EMAIL,
    outDir: '/tmp',
    src: '',
    baseName: '',
    emails: [],
    verbose: false
  }

  let _logger = Logger.getLogger()
  let _pdf = new PDFUtils()

  let _onWriteSuccess = null
  let _onWriteFail = null

  let _currIdx = 0
  let _files = []

  if (typeof params === 'undefined') {
    params = {}
  }

  Object.assign(_options, params)

  if (!_options.src) {
    throw new Error('Error: you must specify params.src.')
  }

  if (!_options.baseName) {
    throw new Error('Error: you must specify params.baseName.')
  }

  function zeroFill (number, width) {
    width -= number.toString().length
    if (width > 0) {
      return new Array(width + (/\./.test(number) ? 2 : 1)).join('0') + number
    }
    return number + '' // always return a string
  }

  let _pageDir = path.join(_options.outDir, 'pages')

  ensureDirectoryExists(_options.outDir)
  ensureDirectoryExists(_pageDir)

  this.setEmails = function (emails) {
    _options.emails = emails
  }

  function writeNextUsingPageBoundaries () {
    let i = _currIdx

    if (i > _options.emails.length - 1) {
      // resolve promise
      this.emit('email-write-complete', {})
      _onWriteSuccess(_files)
      return
    }

    let e = _options.emails[i]

    let outPdf = path.join(_options.outDir, _options.baseName + '-' + zeroFill(i, 6) + '.pdf')
    let outJson = outPdf + '.json'

    _logger.debug(`Email ${i}, pages ${e.start.page} - ${e.end.page} to ${outPdf}`)

    e.files = {
      pdf: outPdf,
      json: outJson
    }

    fs.writeFileSync(outJson, JSON.stringify(e, null, 2))

    let input = []
    for (let j = e.start.page; j <= e.end.page; j++) {
      let p = path.join(_pageDir, 'page-' + zeroFill(j, 6) + '.pdf')
      _logger.debug(`  - ${p}`)
      input.push(p)
    }

    _pdf.concat(input, outPdf, (success) => {
      if (!success) {
        _onWriteFail(new Error('Error writing email with pdftk'))
        return
      }

      _currIdx++
      writeNextUsingPageBoundaries.call(this)
      _files.push(outPdf)
    })
  }

  function writeUsingPageBoundaries () {
    let output = path.join(_pageDir, 'page-%06d.pdf')

    // FIXME -- this doesn't work when the src is a directory; if we're dealing with a directory of input files,
    // it's assumed that each is an individual email.  In such a case, we can skip all the writing and just
    // use the originals (or the OCR-ed version) as the emails that we upload to Document Cloud
    this.emit('start-burst', { output: output })

    _pdf.burst(_options.src, output, (success) => {
      if (!success) {
        throw new Error('Error bursting into individual pages')
      }

      this.emit('start-email-write', {})

      _files = []
      _currIdx = 0
      writeNextUsingPageBoundaries.call(this)
    })
  }

  function writeMultipleToMultiple () {
    for (let i = 0; i < _options.emails.length; i++) {
      let e = _options.emails[i]

      let outPdf = path.join(_options.outDir, _options.baseName + '-' + zeroFill(i, 6) + '.pdf')
      let outJson = outPdf + '.json'
      _logger.debug(`Email ${i}, ${e.file} to ${outPdf}`)

      fs.copyFileSync(e.file, outPdf)

      e.files = {
        pdf: outPdf,
        json: outJson
      }

      fs.writeFileSync(outJson, JSON.stringify(e, null, 2))
      _files.push(outPdf)
    }
  }

  this.write = function () {
    if (!_options.emails) {
      throw new Error('Error: you must set emails with setEmails()')
    }

    let p = new Promise(function (resolve, reject) {
      _onWriteSuccess = resolve
      _onWriteFail = reject
    })

    if (_options.inputType === MultiplePdfWriter.INPUT_TYPE_SINGLE_FILE_PAGE_PER_EMAIL) {
      writeUsingPageBoundaries.call(this)
    } else if (_options.inputType === MultiplePdfWriter.INPUT_TYPE_DIRECTORY_FILE_PER_EMAIL) {
      writeMultipleToMultiple()
      _onWriteSuccess(_files)
    } else {
      _onWriteFail()
    }

    return p
  }
}

MultiplePdfWriter.INPUT_TYPE_SINGLE_FILE_PAGE_PER_EMAIL = 1
MultiplePdfWriter.INPUT_TYPE_DIRECTORY_FILE_PER_EMAIL = 2

MultiplePdfWriter.prototype = Object.create(require('events').EventEmitter.prototype)

export default MultiplePdfWriter
