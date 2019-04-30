const { spawn, spawnSync } = require('child_process')
const os = require('os')
const path = require('path')
import Logger from '../utils/Logger'
import store from '../../store'
// const ElectronPDF = require('electron-pdf')
const { BrowserWindow } = require('electron').remote
const fs = require('fs')

let PDFUtils = function () {
  let s = store()
  let pdftk = s.state.commands.pdftk
  let pdftotext = s.state.commands.pdftotext
  let convert = s.state.commands.convert
  let tesseract = s.state.commands.tesseract
  let chrome = s.state.commands.chrome

  this.unpackPortfolio = function (pdf, outDir, callback) {
    let proc = spawn(pdftk, [pdf, 'unpack_files', 'output', outDir])
    proc.on('close', (code) => {
      callback(code)
    })
  }

  // stolen from recent version of url.js from node.js
  const isWindows = false
  const percentRegEx = /%/g
  const backslashRegEx = /\\/g
  const newlineRegEx = /\n/g
  const carriageReturnRegEx = /\r/g
  const tabRegEx = /\t/g
  function pathToFileURL (filepath) {
    let resolved = path.resolve(filepath)
    // path.resolve strips trailing slashes so we must add them back
    const filePathLast = filepath.charCodeAt(filepath.length - 1)
    if (((filePathLast === '/') ||
       (isWindows && filePathLast === '\\')) &&
      resolved[resolved.length - 1] !== path.sep) { resolved += '/' }
    const outURL = new URL('file://')
    if (resolved.includes('%')) { resolved = resolved.replace(percentRegEx, '%25') }
    // In posix, "/" is a valid character in paths
    if (!isWindows && resolved.includes('\\')) { resolved = resolved.replace(backslashRegEx, '%5C') }
    if (resolved.includes('\n')) { resolved = resolved.replace(newlineRegEx, '%0A') }
    if (resolved.includes('\r')) { resolved = resolved.replace(carriageReturnRegEx, '%0D') }
    if (resolved.includes('\t')) { resolved = resolved.replace(tabRegEx, '%09') }
    outURL.pathname = resolved
    return outURL
  }

  this.ocr = function (pdf, newpdf, callback) {
    let logger = Logger.getLogger()

    // convert PDF to a multipage TIFF
    let tiff = path.join(os.tmpdir(), 'PDFOCR.tiff')
    logger.debug(`[PDFUtils.ocr] converting to tiff: ${tiff}`)
    let proc = spawn(convert, ['-density', 300, pdf, '-depth', 8, '-strip', '-background', 'white', '-alpha', 'off', tiff])
    proc.on('close', (code) => {
      logger.debug(`[PDFUtils.ocr] calling tesseract on ${tiff}`)
      let proc2 = spawn(tesseract, [tiff, newpdf, 'pdf'])
      proc2.on('close', (code) => {
        callback()
      })
    })
  }

  this.htmlToPdf = function (html, pdf, callback) {
    let logger = Logger.getLogger()
    logger.debug('chrome path: ' + chrome)

    let htmlUrl = pathToFileURL(html).href
    let win = new BrowserWindow({ show: false })

    win.webContents.on('did-finish-load', function () {
      win.webContents.printToPDF({
        landscape: false,
        marginsType: 0,
        printBackground: false,
        printSelectionOnly: false,
        pageSize: 'Letter'
      }, function (err, data) {
        if (err) {
        // do whatever you want
          return
        }
        try {
          win.close()
          fs.writeFileSync(pdf, data)
          callback()
        } catch (err) {
          // unable to save pdf..
          win.close()
        }
      })
    })

    win.loadURL(htmlUrl)

    /*

    let e = new ElectronPDF()
    e.on('charged', () => {
      e.createJob(html, pdf).then(job => {
        job.on('job-complete', (r) => {
          console.log('electron-pdf results: ', r)
          callback()
        })
        job.render()
      })
    })
    e.start()
    */

    /*
    let proc = spawn(chrome, ['--headless', '--print-to-pdf=' + pdf, html])
    proc.on('close', (code) => {
      callback(code)
    })
    */
  }

  this.countPages = function (pdf) {
    let proc = spawnSync(pdftk, [pdf, 'dump_data'])
    if (proc.error) {
      throw (proc.error)
    }

    let matches = proc.stdout.toString().match(/NumberOfPages:\s*(\d+)/)
    if (!matches) {
      throw (new Error('Could not find "NumberOfPages" in pdftk output'))
    }

    return parseInt(matches[1])
  }

  this.toText = function (pdf, callback) {
    let logger = Logger.getLogger()
    let _items = []
    let pageNum = 0

    let buffer = ''

    let proc = spawn(pdftotext, ['-htmlmeta', '-bbox', pdf, '-'])
    proc.stdout.on('data', function (data) {
      buffer += data
    })
    proc.on('close', (code) => {
      logger.debug(`[PDFUtils.toText] child process exited with code ${code}`)
      logger.debug('[PDFUtils.toText] buffer size: ' + buffer.length)

      let results = buffer.toString().split('\n')

      for (let i = 0; i < results.length; i++) {
        let line = results[i].trim()
        if (line.match(/<page/)) {
          pageNum++
          callback(null, { page: pageNum })
          continue
        }
        if (line.match(/<\/page/)) {
          _items.sort((a, b) => {
            return a.y === b.y ? a.x - b.x : a.y - b.y
          })
          for (let j = 0; j < _items.length; j++) {
            callback(null, _items[j])
          }
          _items = []
        }
        let matches = line.match(/<word\s+xMin="(.+?)"\s+yMin="(.+?)".+?>(.+?)<\/word>/)
        if (matches) {
          _items.push({
            text: matches[3],
            x: parseFloat(matches[1]),
            y: parseFloat(matches[2])
          })
          continue
        }
      }

      callback(null, null)
    })
  }
}

// module.exports = EmailHeaderScanner
export default PDFUtils
