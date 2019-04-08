const fs = require('fs')
const path = require('path')
const pdftk = require('node-pdftk')

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

  function ensureDirectoryExists (dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }

    if (!isDir(dir)) {
      throw new Error('Error: output directory ' + dir + ' exists, but is not a directory.')
    }

    if (!isDirEmpty(dir)) {
      throw new Error('Error: output directory ' + dir + ' is not empty.')
    }
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
      _onWriteSuccess(_files)
      return
    }

    let e = _options.emails[i]

    let outPdf = path.join(_options.outDir, _options.baseName + '-' + zeroFill(i, 6) + '.pdf')
    let outJson = path.join(_options.outDir, _options.baseName + '-' + zeroFill(i, 6) + '.json')

    console.log(`Email ${i}, pages ${e.start.page} - ${e.end.page} to ${outPdf}`)

    e.files = {
      pdf: outPdf,
      json: outJson
    }

    fs.writeFileSync(outJson, JSON.stringify(e.headers))

    let input = []
    for (let j = e.start.page; j <= e.end.page; j++) {
      let p = path.join(_pageDir, 'page-' + zeroFill(j, 6) + '.pdf')
      console.log(`  - ${p}`)
      input.push(p)
    }

    pdftk.input(input).cat().output(outPdf).then(() => {
      _currIdx++
      writeNextUsingPageBoundaries()
    }, (err) => {
      _onWriteFail(err)
    })

    _files.push(outPdf)
  }

  function writeUsingPageBoundaries () {
    let output = path.join(_pageDir, 'page-%06d.pdf')

    console.log('[writeUsingPageBoundaries] bursting into pages: ' + output)
    pdftk.input(_options.src).burst(output).then(() => {
      console.log('[writeUsingPageBoundaries] done with burst')

      _files = []
      _currIdx = 0
      writeNextUsingPageBoundaries()
    }).catch(err => {
      throw new Error('Error bursting into individual pages: ' + err.message)
    })
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
