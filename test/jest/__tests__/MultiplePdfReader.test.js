const os = require('os')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const rimraf = require('rimraf')
import MultiplePdfReader from '../../../src/lib/readers/MultiplePdfReader'
import PDFUtils from '../../../src/lib/utils/PDFUtils'
import Logger from '../../../src/lib/utils/Logger'
const ensureDirectoryExists = require('../../../src/lib/utils/Filesystem').ensureDirectoryExists

let testOutDir = path.join(os.tmpdir(), 'mailshredder-test-multiple')

function setupTest () {
  rimraf.sync(testOutDir)
  ensureDirectoryExists(testOutDir)
}

function runTest (testData, performOCR, unpackPortfolio) {
  setupTest()

  Logger.init(testOutDir)
  let pdf = new PDFUtils()
  pdf.init()

  let testDir = testData
  if (testDir.match(/\.pdf$/)) {
    testDir = path.dirname(testData)
  }

  let expectedEmailStr = fs.readFileSync(path.join(testDir, 'expected.json')).toString()

  let r = new MultiplePdfReader({
    src: testData,
    outDir: testOutDir,
    performOCR: performOCR,
    unpackPortfolio: unpackPortfolio
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

// note -- this tranche is a little bit artificial, in that the individual PDFs were split out of
// a single monolithic PDF using mailshredder, so it stands to reason that every PDF will have a
// set of headers that can be recognized by mailshredder.  It would be better to get an actual
// multi-PDF, searchable text (meaning we don't have to run OCR) tranche.
test('Multiple PDFs, no OCR', () => {
  return runTest('./test/data/tranche-001/', false, false)
}, 1200000)

test('Single PDF Portfolio', () => {
  return runTest('./test/data/tranche-002/Greensboro-response-opt.pdf', false, true)
}, 1200000)

test('Multiple PDFs, OCR', () => {
  return runTest('./test/data/tranche-003/', true, false)
}, 1200000)
