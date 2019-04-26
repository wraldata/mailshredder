const { spawn } = require('child_process')
const os = require('os')
const path = require('path')
import Logger from '../utils/Logger'
import store from '../../store'

let PDFUtils = function () {
  let s = store()
  let pdftk = s.state.commands.pdftk
  let pdftotext = s.state.commands.pdftotext
  let convert = s.state.commands.convert
  let tesseract = s.state.commands.tesseract

  this.unpackPortfolio = function (pdf, outDir, callback) {
    let proc = spawn(pdftk, [pdf, 'unpack_files', 'output', outDir])
    proc.on('close', (code) => {
      callback(code)
    })
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
        logger.debug('[PDFUtils.toText] no match')
      }

      callback(null, null)
    })
  }
}

// module.exports = EmailHeaderScanner
export default PDFUtils
