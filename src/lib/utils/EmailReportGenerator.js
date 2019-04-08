const fs = require('fs')
const path = require('path')
const moment = require('moment')

function EmailReportGenerator () {
  let _reportLines = []
  let _recipients = {}
  let _senders = {}

  function scanEmail (e) {
    let subject = (e.headers['Subject']) ? e.headers['Subject'].value : ''
    let from = (e.headers['From']) ? e.headers['From'].value : ''
    let to = (e.headers['To']) ? e.headers['To'].value : ''
    let date = (e.headers['Date']) ? e.headers['Date'].value : ''
    let numPages = e.end.page - e.start.page + 1

    // clean up the to values
    let toValues = to.split(';')
    toValues.map(r => { r = r.trim(); _recipients[r] = (_recipients[r]) ? _senders[from] + 1 : 1; return r })
    to = toValues.join('; ')

    from = from.trim()
    _senders[from] = (_senders[from]) ? _senders[from] + 1 : 1

    subject = subject.trim()
    date = new Date(date.trim())

    date = moment(date).format('YYYY-MM-DD HH:mm:ss')

    _reportLines.push([from, to, subject, date, numPages])
  }

  function sortObject (obj) {
    var arr = []
    for (var prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        arr.push({
          'key': prop,
          'value': obj[prop]
        })
      }
    }
    arr.sort(function (a, b) { return b.value - a.value })
    // arr.sort(function(a, b) { a.value.toLowerCase().localeCompare(b.value.toLowerCase()); }); //use this to sort as strings
    return arr // returns array
  }

  function outputSortedObject (obj, file) {
    let sorted = sortObject(obj)

    try {
      let fd = fs.openSync(file, 'w')
      for (let i = 0; i < sorted.length; i++) {
        let o = sorted[i]
        if (o.key === '') {
          continue
        }
        fs.writeSync(fd, o.key + '\t' + o.value + '\n')
      }
      fs.closeSync(fd)
    } catch (e) {
      throw new Error(`Error writing to ${file}: ` + e.message)
    }
  }

  this.generate = function (emails, outDir, baseName) {
    JSON.stringify(emails, null, 2)

    let outJson = path.join(outDir, baseName + '-emails.json')
    fs.writeFileSync(outJson, JSON.stringify(emails, null, 2))

    for (let i = 0; i < emails.length; i++) {
      let e = emails[i]

      scanEmail(e)
    }

    let outTxt = path.join(outDir, baseName + '-emails.txt')
    try {
      let fd = fs.openSync(outTxt, 'w')
      for (let i = 0; i < _reportLines.length; i++) {
        fs.writeSync(fd, _reportLines[i].join('\t') + '\n')
      }
      fs.closeSync(fd)
    } catch (e) {
      throw new Error(`Error writing to ${outTxt}: ` + e.message)
    }

    outTxt = path.join(outDir, baseName + '-senders.txt')
    outputSortedObject(_senders, outTxt)

    outTxt = path.join(outDir, baseName + '-recipients.txt')
    outputSortedObject(_recipients, outTxt)
  }
}

module.exports = EmailReportGenerator
