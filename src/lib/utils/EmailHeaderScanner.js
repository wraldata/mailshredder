
let EmailHeaderScanner = function () {
  let _headersFound = {}
  let _continuation = false
  let _continuationHeader = null
  let _lastHeader = null
  // we expect headers to be horizontally aligned, but they're not always perfectly aligned;
  // how far out of horizontal alignment can they be before we decide that a given piece of text
  // is not actually a header?
  let _xPosTolerance = 1

  function containsEmail (text) {
    if (text.match(/\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+/)) {
      return true
    }

    return false
  }

  function headerShouldHaveAddresses (h) {
    if (h.header.match(/^\s*(From|To|Cc|Bcc)/)) {
      return true
    }

    return false
  }

  function scanForNewHeader (line) {
    let matches = line.text.match(/^\s*(From|To|Subject|Date|Sent|Attachments|Cc|Bcc):\s+(.+)/)
    if (!matches) {
      return false
    }

    // make sure that all the headers have the same x coordinate (if we find a line with a larger
    // x coordinate, it is likely a quoted email inside the email)
    for (let h in _headersFound) {
      let foundLine = _headersFound[h].line
      let delta = Math.abs(line.x - foundLine.x)
      if (delta > _xPosTolerance) {
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
    //
    // FIXME: this is sort of a continuation header, but it doesn't have any sort of hint on the first line that it might
    // be a continuation header, so the logic used for _continuationHeader wouldn't really work
    if (_lastHeader && headerShouldHaveAddresses(_lastHeader)) {
      if (line.text.match(/CN=RECIPIENTS/i)) {
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

  this.reset = function () {
    _headersFound = {}
    _continuation = false
    _continuationHeader = null
  }
}

// module.exports = EmailHeaderScanner
export default EmailHeaderScanner
