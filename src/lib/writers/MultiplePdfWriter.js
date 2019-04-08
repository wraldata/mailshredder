const fs = require('fs')
const path = require('path')

let MultiplePdfWriter = function (params) {
  let _options = {
    newPageForEachMessage: true, // this refers more to the format of the input Pdf
    outDir: '/tmp',
    src: '',
    baseName: '',
    emails: [],
    verbose: false
  }

  let _onWriteSuccess = null
  let _onWriteFail = null

  let _pdfreader = null
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

  function isDirEmpty (path) {
    try {
      let files = fs.readdirSync(path)
      return (files.length < 1)
    } catch (e) {
      throw new Error(`Error: could not determine if "${path}" is empty: ${e.message}`)
    }
  }

  function isDir (path) {
    try {
      let stat = fs.lstatSync(path)
      return stat.isDirectory()
    } catch (e) {
      // lstatSync throws an error if path doesn't exist
      return false
    }
  }

  function zeroFill (number, width) {
    width -= number.toString().length
    if (width > 0) {
      return new Array(width + (/\./.test(number) ? 2 : 1)).join('0') + number
    }
    return number + '' // always return a string
  }

  if (!fs.existsSync(_options.outDir)) {
    fs.mkdirSync(_options.outDir)
  }

  if (!isDir(_options.outDir)) {
    throw new Error('Error: output directory ' + _options.outDir + ' exists, but is not a directory.')
  }

  if (!isDirEmpty(_options.outDir)) {
    throw new Error('Error: output directory ' + _options.outDir + ' is not empty.')
  }

  this.setEmails = function (emails) {
    _options.emails = emails
  }

  function writeNextUsingPageBoundaries () {
    let i = _currIdx

    if (i > _options.emails.length - 1) {
      // resolve promise
      _onWriteSuccess(_files)
      return
    }

    let e = _options.emails[i]
    console.log(`Email ${i}, pages ${e.start.page} to ${e.end.page}`)

    let outPdf = path.join(_options.outDir, _options.baseName + '-' + zeroFill(i, 6) + '.pdf')
    let outJson = path.join(_options.outDir, _options.baseName + '-' + zeroFill(i, 6) + '.json')

    e.files = {
      pdf: outPdf,
      json: outJson
    }

    fs.writeFileSync(outJson, JSON.stringify(e.headers))

    let pdf = _pdfreader.range(e.start.page, e.end.page)
    pdf.pdfStream().pipe(fs.createWriteStream(outPdf)).on('finish', function () {
      _currIdx++
      writeNextUsingPageBoundaries()
    }).on('error', function (err) {
      _onWriteFail(err)
    })

    _files.push(outPdf)
  }

  function writeUsingPageBoundaries () {
    var scissors = require('scissors')
    _pdfreader = scissors(_options.src)

    _files = []
    _currIdx = 0

    writeNextUsingPageBoundaries()
  }

  this.write = function () {
    if (!_options.emails) {
      throw new Error('Error: you must set emails with setEmails()')
    }

    let p = new Promise(function (resolve, reject) {
      _onWriteSuccess = resolve
      _onWriteFail = reject
    })

    if (_options.newPageForEachMessage) {
      writeUsingPageBoundaries()
    } else {
      _onWriteFail()
    }

    return p
  }
}

export default MultiplePdfWriter
