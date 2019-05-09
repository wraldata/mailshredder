import Logger from './Logger'

let EmailHeaderScanner = function () {
  let _logger = Logger.getLogger()

  let _headersFound = {}
  let _continuation = false
  let _continuationHeader = null
  let _lastHeader = null
  // we expect headers to be horizontally aligned, but they're not always perfectly aligned;
  // how far out of horizontal alignment can they be before we decide that a given piece of text
  // is not actually a header?
  let _xPosTolerance = 1

  // how many non-headers will we allow before the first right-aligned header block?
  let _maxNumNonHeadersBeforeRightJustifiedHeaderBlock = 1

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
  let _maxNumNonHeadersInRightJustifiedHeaderBlock = 7

  function containsEmail (text) {
    if (text.match(/\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+/)) {
      return true
    }

    return false
  }

  function headerShouldHaveAddresses (h) {
    if (h.header.match(/^\s*(From|To|Cc|Bcc)/i)) {
      return true
    }

    return false
  }

  function scanForNewHeader (line) {
    _logger.debug('scanning line for header')
    let matches = line.text.match(/^\s*(From|To|Subject|Date|Sent|Attachments|Cc|Bcc):\s+(.+)/i)
    if (!matches) {
      _logger.debug('no match')
      return false
    }

    // make sure that all the headers have the same x coordinate (if we find a line with a larger
    // x coordinate, it is likely a quoted email inside the email)
    for (let h in _headersFound) {
      let foundLine = _headersFound[h].line
      let delta = Math.abs(line.x - foundLine.x)
      if (delta > _xPosTolerance) {
        _logger.debug('xpos tolerance violation')
        return false
      }
    }

    let hf = {
      header: matches[1],
      value: matches[2],
      line: { ...line } // clone the line
    }
    _logger.debug('identified header: ' + matches[1])
    _headersFound[matches[1]] = hf

    _continuation = false
    _continuationHeader = null
    // FIXME -- this will falsely match on lines that end with HTML entities, like "&gt;", for example.
    if (line.text.match(/[;,]\s*$/)) {
      _logger.debug('looks like a continuation header')
      _continuation = true
      _continuationHeader = hf
    }

    return hf
  }

  function scanForTypicalHeaders (line) {
    // look for a header that starts on this line
    let foundHeader = scanForNewHeader(line)
    if (foundHeader) {
      _lastHeader = foundHeader
      return foundHeader
    }

    // didn't find the start of a new header, but if the previous header suggested that it was
    // a continuation, this might be a continuation (the only kind of continuation we can
    // recognize is when it's like a "To" line that gets wrapped, and even then our matching
    // is pretty fragile)
    if (_continuation) {
      // TODO: if a genuine header ended with ";" or ",", and then a non-header line happened to
      // have an email address in it, we would falsely consider it to be a continuation of the
      // previous header
      if (containsEmail(line.text)) {
        _continuationHeader.value += ' ' + line.text
        return _continuationHeader
      }
    }

    // Deal with outlook output that might look like this:
    //  From: Akroyd, Cathy R [/O=EXCHANGELABS/OU=EXCHANGE ADMINISTRATIVE GROUP
    //        (FYDIBOHF23SPDLT)/CN=RECIPIENTS/CN=82FDF2DE4BE5481C8F01C933B5F2CAB9-CRAKROYD]
    //  To:   Talley,NoelleS$[/o=ExchangeLabs/ou=ExchangeAdministrativeGroup
    //        (FYDIBOHF23SPDLT)/cn=Recipients/cn=cd9f3882421746bcb5a60cbe82cdff89-nstalley]; Weiner, Sadie
    //        [/o=ExchangeLabs/ou=Exchange Administrative Group
    //        (FYDIBOHF23SPDLT)/cn=Recipients/cn=df98bd64929043eeaab54e589dd7d1b2-asweiner]
    //
    // FIXME: this is sort of a continuation header, but it doesn't have any sort of hint on the first line that it might
    // be a continuation header, so the logic used for _continuationHeader wouldn't really work
    if (_lastHeader && headerShouldHaveAddresses(_lastHeader)) {
      if (line.text.match(/\/(o=exchange|ou=|cn=|)/i)) {
        _lastHeader.value += ' ' + line.text
        return _lastHeader
      }
    }

    _lastHeader = null
    return false
  }

  function foundCriticalHeaders () {
    if (_headersFound['From'] && _headersFound['Subject'] &&
      (_headersFound['Date'] || _headersFound['Sent'])) {
      return true
    }

    return false
  }

  function getStartOfHeaderBlock () {
    let start = {
      page: Number.POSITIVE_INFINITY,
      y: Number.POSITIVE_INFINITY
    }

    let found = false
    for (let h in _headersFound) {
      let line = _headersFound[h].line
      found = true
      if ((line.page < start.page) || ((line.page === start.page) && (line.y < start.y))) {
        start.page = line.page
        start.y = line.y
      }
    }

    if (!found) {
      return false
    }

    return start
  }

  this.scanLine = function (line) {
    let headerScan = scanForTypicalHeaders(line)
    if (headerScan) {
      return ['header', headerScan]
    }

    // if this line is *not* a header, do we have enough headers to reasonably assume this is a new email?
    if (foundCriticalHeaders()) {
      let start = getStartOfHeaderBlock()
      if (start) {
        let retval = ['email_start', start, _headersFound]
        this.reset()
        return retval
      }
    }

    return ['non-header', {}]
  }

  this.scanForRightJustifiedHeaders = function (lines) {
    _logger.debug('Scanning for right-justified headers...')

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
          _logger.debug('Line ' + i + ', found "' + matches[1] + '" - already seen this header; not parsing for more right-justified headers')
          break
        }

        if (xAlign === Number.NEGATIVE_INFINITY) {
          xAlign = firstItem.xMax
        }
        let delta = Math.abs(xAlign - firstItem.xMax)
        _logger.debug('Line ' + i + ', found "' + matches[1] + '" ("' + lines[i].text + '"); xdelta: ' + delta)
        if (delta > _xPosTolerance) {
          // if we find a header-like label but it doesn't right-align with any others that we've seen,
          // then we're not dealing with right-justified headers
          _logger.debug('misaligned header label; email is probably not using right-justified headers')
          return false
        }
        _logger.debug('keep header; setting maxHeaderIdx to ' + i)
        maxHeaderIdx = i
        alreadySeen[matches[1]] = 1
      } else {
        if (i - maxHeaderIdx > _maxNumNonHeadersInRightJustifiedHeaderBlock) {
          _logger.debug('too many lines seen without a header label; not parsing for more right-justified headers')
          break
        }
      }

      linesProcessed++
      if ((linesProcessed > _maxNumNonHeadersBeforeRightJustifiedHeaderBlock) && (maxHeaderIdx === -1)) {
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
      _headersFound = {}
      return false
    }

    return _headersFound
  }

  this.reset = function () {
    _headersFound = {}
    _continuation = false
    _continuationHeader = null
  }
}

// module.exports = EmailHeaderScanner
export default EmailHeaderScanner
