const fs = require('fs')
const path = require('path')

let MonolithicPdfWriter = function (params) {
  let _options = {
    newPageForEachMessage: true, // this refers more to the format of the input Pdf
    outDir: '/tmp',
    src: '',
    emails: [],
    verbose: false
  }

  if (typeof params === 'undefined') {
    params = {}
  }

  Object.assign(_options, params)

  if (!_options.src) {
    throw new Error('Error: you must specify params.src.')
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

  this.setEmails = function (emails) {
    _options.emails = emails
  }

  function writeUsingPageBoundaries () {
    var scissors = require('scissors')
    let pdfReader = scissors(_options.src)

    let files = []

    for (let i = 0; i < _options.emails.length; i++) {
      let e = _options.emails[i]
      console.log(`Email ${i}, pages ${e.start.page} to ${e.end.page}`)

      let outPdf = path.join(_options.outDir, 'mailshredder-' + zeroFill(i, 6) + '.pdf')
      let outJson = path.join(_options.outDir, 'mailshredder-' + zeroFill(i, 6) + '.json')

      fs.writeFileSync(outJson, JSON.stringify(e.headers))

      let pdf = pdfReader.range(e.start.page, e.end.page)
      pdf.pdfStream.pipe(fs.createWriteStream(outPdf))

      files.push(outPdf)
    }

    return files
  }

  this.write = function () {
    if (!_options.emails) {
      throw new Error('Error: you must set emails with setEmails()')
    }

    if (_options.newPageForEachMessage) {
      return writeUsingPageBoundaries()
    }
  }
}

module.exports = MonolithicPdfWriter
