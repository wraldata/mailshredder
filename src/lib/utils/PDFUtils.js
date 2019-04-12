const { spawn, execSync } = require('child_process')
const os = require('os')
const path = require('path')

let PDFUtils = function () {
  this.ocr = function (pdf, newpdf) {
    // convert PDF to a multipage TIFF
    let tiff = path.join(os.tmpdir(), 'PDFOCR.tiff')
    let cmd = `convert -density 300 '${pdf}' -depth 8 -strip -background white -alpha off '${tiff}'`
    console.log(cmd)
    execSync(cmd)

    // perform OCR with tesseract, creating a searchable PDF
    cmd = `tesseract '${tiff}' '${newpdf}' pdf`
    console.log(cmd)
    execSync(cmd)
  }

  this.toText = function (pdf, callback) {
    let _items = []
    let pageNum = 0

    let cmd = `pdftotext -htmlmeta -bbox '${pdf}' -`
    console.log(cmd)
    let pdftotext = spawn('pdftotext', ['-htmlmeta', '-bbox', pdf, '-'])
    pdftotext.on('close', (code) => {
      console.log(`child process exited with code ${code}`)
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
