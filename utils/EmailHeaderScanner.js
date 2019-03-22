
let EmailHeaderScanner = function () {
  let _headersFound = {}
  let _continuation = false
  let _continuationHeader = null

  function containsEmail (text) {
    if (text.match(/\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+/)) {
      return true
    }

    return false
  }

  function scanForNewHeader (line) {
    let matches = line.text.match(/^\s*(From|To|Subject|Date|Attachments|Cc|Bcc):\s+(.+)/)
    if (!matches) {
      return false
    }

    // make sure that all the headers have the same x coordinate (if we find a line with a larger
    // x coordinate, it is likely a quoted email inside the email)
    for (let h in _headersFound) {
      let foundLine = _headersFound[h].line
      if (line.x !== foundLine.x) {
        return false
      }
    }

    let hf = {
      header: matches[1],
      value: matches[2],
      line: { ...line } // clone the line
    }
    _headersFound[matches[1]] = hf

    _continuation = false
    _continuationHeader = null
    if (line.text.match(/[;,]\s*$/)) {
      _continuation = true
      _continuationHeader = hf
    }

    return hf
  }

  function scanForTypicalHeaders (line) {
    // look for a header that starts on this line
    let foundHeader = scanForNewHeader(line)
    if (foundHeader) {
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

    return false
  }

  function foundCriticalHeaders () {
    if (_headersFound['From'] && _headersFound['Subject'] && _headersFound['Date']) {
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

  this.reset = function () {
    _headersFound = {}
    _continuation = false
    _continuationHeader = null
  }
}

module.exports = EmailHeaderScanner
