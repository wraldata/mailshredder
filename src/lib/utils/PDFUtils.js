const { spawn } = require('child_process')
const os = require('os')
const path = require('path')
const pdftk = require('node-pdftk')
import Logger from '../utils/Logger'

let PDFUtils = function () {
  this.unpackPortfolio = function (pdf, outDir, callback) {
    pdftk.input(pdf).unpackFiles(outDir).then(() => {
      callback(pdftk.error)
    })
  }

  this.ocr = function (pdf, newpdf, callback) {
    let logger = Logger.getLogger()

    // convert PDF to a multipage TIFF
    let tiff = path.join(os.tmpdir(), 'PDFOCR.tiff')
    logger.debug(`[PDFUtils.ocr] converting to tiff: ${tiff}`)
    let proc = spawn('convert', ['-density', 300, pdf, '-depth', 8, '-strip', '-background', 'white', '-alpha', 'off', tiff])
    proc.on('close', (code) => {
      logger.debug(`[PDFUtils.ocr] calling tesseract on ${tiff}`)
      let proc2 = spawn('tesseract', [tiff, newpdf, 'pdf'])
      proc2.on('close', (code) => {
        callback()
      })
    })
  }

  this.toText = function (pdf, callback) {
    let logger = Logger.getLogger()
    let _items = []
    let pageNum = 0

    let cmd = `pdftotext -htmlmeta -bbox '${pdf}' -`
    logger.debug(cmd)
    let pdftotext = spawn('pdftotext', ['-htmlmeta', '-bbox', pdf, '-'])
    pdftotext.on('close', (code) => {
      logger.debug(`child process exited with code ${code}`)
      callback(null, null)
    })
    pdftotext.stdout.on('data', function (data) {
      let results = data.toString().split('\n')

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
    })
  }
}

// module.exports = EmailHeaderScanner
export default PDFUtils
