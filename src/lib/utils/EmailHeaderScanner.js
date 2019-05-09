import Logger from './Logger'

let EmailHeaderScanner = function () {
  let _logger = Logger.getLogger()

  let _headersFound = {}

  // we expect headers to be horizontally aligned, but they're not always perfectly aligned;
  // how far out of horizontal alignment can they be before we decide that a given piece of text
  // is not actually a header?
  let _xPosTolerance = 1

  // how many non-headers will we allow before the first right-aligned header block?
  // some email PDF dumps have a "masthead" line at the top of the page before the headers
  // for example, a user's name at the top
  let _maxNumNonHeadersBeforeHeaderBlock = 1

  // it's possible to have something like this:
  //     Date: Wed May 15, 2019 05:00 PM
  //       To: recipient1@example.com
  //           recipient2@example.com
  //           recipient3@example.com
  //           recipient4@example.com
  //  Subject: Subject line here
  //
  // but how many lines are you willing to attribute to the "To:" header?  If this number is too
  // high, you can end up finding something that looks like a right-aligned header deep inside
  // the body of the message, causing everything from the top of the message to that deep header
  // to be interpreted as headers
  let _maxNumNonHeadersInHeaderBlock = 7

  function foundCriticalHeaders () {
    if (_headersFound['From'] && _headersFound['Subject'] &&
      (_headersFound['Date'] || _headersFound['Sent'])) {
      return true
    }

    return false
  }

  this.scanForHeaders = function (lines, rightJustified) {
    _headersFound = {}
    let side = rightJustified ? 'right' : 'left'
    _logger.debug(`Scanning for ${side}-justified headers...`)

    // first see how many lines look like they have right-justified header labels
    let xAlign = Number.NEGATIVE_INFINITY
    let maxHeaderIdx = -1
    let linesProcessed = 0
    let alreadySeen = {}
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].items.length < 1) {
        continue
      }

      let firstItem = lines[i].items[0]
      let matches = firstItem.text.match(/^\s*(From|To|Subject|Date|Sent|Attachments|Cc|Bcc):\s*/i)
      if (matches) {
        if (typeof alreadySeen[matches[1]] !== 'undefined') {
          _logger.debug(`Line ${i}, found "${matches[1]}" - already seen this header; not parsing for more ${side}-justified headers`)
          break
        }

        let xTest = (rightJustified) ? firstItem.xMax : firstItem.x

        if (xAlign === Number.NEGATIVE_INFINITY) {
          xAlign = xTest
        }
        let delta = Math.abs(xAlign - xTest)
        _logger.debug(`Line ${i}, found "${matches[1]}" ("${lines[i].text}"); x delta: ${delta}`)
        if (delta > _xPosTolerance) {
          // if we find a header-like label but it doesn't align with any others that we've seen,
          // then we're not dealing with right-justified headers
          _logger.debug(`misaligned header label; not parsing for more ${side}-justified headers`)
          break
        }
        _logger.debug(`keep header; setting maxHeaderIdx to i`)
        maxHeaderIdx = i
        alreadySeen[matches[1]] = 1
      } else {
        if (i - maxHeaderIdx > _maxNumNonHeadersInHeaderBlock) {
          _logger.debug(`too many lines seen without a header label; not parsing for more ${side}-justified headers`)
          break
        }
      }

      linesProcessed++
      if ((linesProcessed > _maxNumNonHeadersBeforeHeaderBlock) && (maxHeaderIdx === -1)) {
        // if we haven't found any conclusive headers by the time we have processed the first
        // two lines, then bail out
        return false
      }
    }

    // if we didn't find any right-justified header labels, then bail out
    if (maxHeaderIdx === -1) {
      return false
    }

    // if we did find right-justified header labels, process all the headers up to maxHeaderIdx, building up our header array;
    // all lines in this range that *don't* have right-justified header labels will be assumed to be continuation of the
    // previous header
    let currHeader = null
    for (let i = 0; i <= maxHeaderIdx; i++) {
      let matches = lines[i].text.match(/^\s*(From|To|Subject|Date|Sent|Attachments|Cc|Bcc):\s*(.+)/i)
      if (matches) {
        currHeader = {
          header: matches[1],
          value: matches[2],
          line: { ...lines[i] }
        }
        _headersFound[matches[1]] = currHeader
      } else {
        if (currHeader) {
          currHeader.value += ' ' + lines[i].text
        }
      }
    }

    if (!foundCriticalHeaders()) {
      _logger.debug(`Did not find enough of the critical headers to conclusively identify the header block`)
      _headersFound = {}
      return false
    }

    _logger.debug(`Found ${side}-justified headers.`)
    return _headersFound
  }
}

// module.exports = EmailHeaderScanner
export default EmailHeaderScanner
