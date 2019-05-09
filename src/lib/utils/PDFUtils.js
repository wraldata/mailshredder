const { spawn, spawnSync } = require('child_process')
const os = require('os')
const path = require('path')
import Logger from '../utils/Logger'
const fs = require('fs')

let _commands = []

let PDFUtils = function () {
  this.unpackPortfolio = function (pdf, outDir, callback) {
    let proc = spawn(_commands['pdftk'], [pdf, 'unpack_files', 'output', outDir])
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
    let proc = spawn(_commands['convert'], ['-density', 300, pdf, '-depth', 8, '-strip', '-background', 'white', '-alpha', 'off', tiff])
    proc.on('close', (code) => {
      logger.debug(`[PDFUtils.ocr] calling tesseract on ${tiff}`)
      let proc2 = spawn(_commands['tesseract'], [tiff, newpdf, 'pdf'])
      proc2.on('close', (code) => {
        callback()
      })
    })
  }

  this.htmlToPdf = function (html, pdf, callback) {
    const { BrowserWindow } = require('electron').remote

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
  }

  this.countPages = function (pdf) {
    let proc = spawnSync(_commands['pdftk'], [pdf, 'dump_data'])
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

    let proc = spawn(_commands['pdftotext'], ['-htmlmeta', '-bbox', pdf, '-'])

    proc.on('error', (err) => {
      console.log('Error: ', err)
    })

    proc.on('disconnect', () => {
      console.log('Disconnected')
    })

    proc.stdout.on('data', function (data) {
      buffer += data

      let bufStr = buffer.toString()
      let closePageIdx = bufStr.lastIndexOf('</page>')
      if (closePageIdx !== -1) {
        closePageIdx += 6
        let chunk = bufStr.substr(0, closePageIdx + 1)
        processChunk(chunk)

        // reset the buffer to just the leftover portion
        let leftover = bufStr.substr(closePageIdx + 1)
        buffer = Buffer.from(leftover, 'utf8')
      }
    })

    function processChunk (chunk) {
      let results = chunk.split('\n')

      for (let i = 0; i < results.length; i++) {
        let line = results[i].trim()
        if (line.match(/<page/)) {
          pageNum++
          callback(null, { pageStart: pageNum })
          continue
        }
        if (line.match(/<\/page/)) {
          _items.sort((a, b) => {
            return a.y === b.y ? a.x - b.x : a.y - b.y
          })
          for (let j = 0; j < _items.length; j++) {
            callback(null, _items[j])
          }
          callback(null, { pageEnd: pageNum })
          _items = []
        }
        let matches = line.match(/<word\s+xMin="(.+?)"\s+yMin="(.+?)"\s+xMax="(.+?)"\s+yMax="(.+?)".*?>(.+?)<\/word>/)
        if (matches) {
          _items.push({
            text: matches[5],
            x: parseFloat(matches[1]),
            y: parseFloat(matches[2]),
            xMax: parseFloat(matches[3]),
            yMax: parseFloat(matches[4])
          })
          continue
        }
      }
    }

    proc.on('close', (code) => {
      logger.debug(`[PDFUtils.toText] child process exited with code ${code}`)
      logger.debug('[PDFUtils.toText] buffer size: ' + buffer.length)

      processChunk(buffer.toString())

      callback(null, null)
    })
  }

  this.concat = function (inputFiles, outputFile, onClose) {
    let args = inputFiles.concat()
    args.push('cat')
    args.push('output')
    args.push(outputFile)
    let proc = spawn(_commands['pdftk'], args)
    proc.on('close', (code) => {
      onClose(!code)
    })
  }

  this.burst = function (inputFile, output, onClose) {
    let proc = spawn(_commands['pdftk'], [inputFile, 'burst', 'output', output])
    proc.on('close', (code) => {
      onClose(!code)
    })
  }

  // FIXME -- this is a total hack:
  //    - it has a hard-coded list of directories
  //    - it won't work on windows
  //    - it doesn't even check to see if a file is executable
  //
  // I tried using the command-exists npm module, but when the app is compiled and
  // run from the finder, the PATH is apparently not set, so commnd-exists can't find
  // any of the executables (and I suspect we wouldn't be able to run the commands, either)
  function findExecutable (executable, key) {
    let dirs = [
      '/bin',
      '/usr/bin',
      '/usr/local/bin',
      '/opt/local/bin'
    ]
    for (let i = 0; i < dirs.length; i++) {
      let dir = dirs[i]
      let fullPath = path.join(dir, executable)
      if (fs.existsSync(fullPath)) {
        _commands[key] = fullPath
        // console.log(`found ${executable}: ${fullPath}`)
        return true
      }
    }
    console.log(`could not find ${executable}`)
    return false
  }

  this.init = function () {
    if (findExecutable('convert', 'convert') &&
        findExecutable('pdftk', 'pdftk') &&
        findExecutable('pdftotext', 'pdftotext') &&
        findExecutable('tesseract', 'tesseract')) {
      return true
    }

    return false
  }
}

// module.exports = EmailHeaderScanner
export default PDFUtils
