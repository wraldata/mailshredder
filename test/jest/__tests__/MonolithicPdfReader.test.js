const os = require('os')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const rimraf = require('rimraf')
import MonolithicPdfReader from '../../../src/lib/readers/MonolithicPdfReader'
import PDFUtils from '../../../src/lib/utils/PDFUtils'
import Logger from '../../../src/lib/utils/Logger'
const ensureDirectoryExists = require('../../../src/lib/utils/Filesystem').ensureDirectoryExists

let testOutDir = path.join(os.tmpdir(), 'mailshredder-test-mono')

function setupTest () {
  rimraf.sync(testOutDir)
  ensureDirectoryExists(testOutDir)
}

function runTest (testData, performOCR, headerJustification) {
  setupTest()

  Logger.init(testOutDir)
  let pdf = new PDFUtils()
  pdf.init()

  let testDir = testData
  if (testDir.match(/\.pdf$/)) {
    testDir = path.dirname(testData)
  }

  let expectedEmailStr = fs.readFileSync(path.join(testDir, 'expected.json')).toString()

  let r = new MonolithicPdfReader({
    src: testData,
    outDir: testOutDir,
    performOCR: performOCR,
    headerJustification: headerJustification
  })

  return r.read().then((emails) => {
    let emailStr = JSON.stringify(emails, null, 2)
    // write the complete JSON to a file in case you need more in-depth diagnostics
    fs.writeFileSync(path.join(testDir, 'complete.json'), emailStr)

    // but use a stripped-down version of the data to pass/fail the test, since it will be
    // easier to quickly cross reference against the original tranche files; also normalize
    // the path so that tests will pass on different machines which may have different /tmp dirs
    let newEmails = []
    for (let i = 0; i < emails.length; i++) {
      let newEmail = {
        file: emails[i].file.replace(testOutDir, '.'),
        start: emails[i].start.page,
        end: emails[i].end.page
      }
      for (let k in emails[i].headers) {
        newEmail[k] = emails[i].headers[k].value
      }

      newEmails.push(newEmail)
    }
    let newEmailStr = JSON.stringify(newEmails, null, 2)

    fs.writeFileSync(path.join(testDir, 'actual.json'), newEmailStr)
    fs.copyFileSync(path.join(testOutDir, 'mailshredder.log'), path.join(testDir, 'mailshredder.log'))

    let newEmailStrHash = crypto.createHash('md5').update(newEmailStr).digest('hex')
    let expectedEmailStrHash = crypto.createHash('md5').update(expectedEmailStr).digest('hex')

    expect(newEmailStrHash).toBe(expectedEmailStrHash)
  })
}

test('Tranche 004 - Monolithic PDF, no OCR, 1 pre-header line', () => {
  return runTest('./test/data/tranche-004/unc_system.pdf', false, 'left')
}, 1200000)

test('Tranche 005 - Monolithic PDF, no OCR, no pre-header lines', () => {
  return runTest('./test/data/tranche-005/blackbeard.pdf', false, 'left')
}, 1200000)

test('Tranche 006 - Monolithic PDF, no OCR, right-justified header labels', () => {
  return runTest('./test/data/tranche-006/wake.pdf', false, 'right')
}, 1200000)
