const os = require('os')
const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
import MonolithicPdfReader from '../../../src/lib/readers/MonolithicPdfReader'
import PDFUtils from '../../../src/lib/utils/PDFUtils'
import Logger from '../../../src/lib/utils/Logger'
const ensureDirectoryExists = require('../../../src/lib/utils/Filesystem').ensureDirectoryExists

let testOutDir = path.join(os.tmpdir(), 'mailshredder-test')

function setupTest () {
  rimraf.sync(testOutDir)
  ensureDirectoryExists(testOutDir)
}

function runTest (testData, performOCR) {
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
    performOCR: performOCR
  })

  return r.read().then((emails) => {
    let emailStr = JSON.stringify(emails, null, 2)
    // fs.writeFileSync(path.join(testDir, 'actual.json'), emailStr)
    expect(emailStr).toBe(expectedEmailStr)
  })
}

test('Monolithic PDF, no OCR, 1 pre-header line', () => {
  return runTest('./test/data/tranche-004/unc_system.pdf', false)
}, 1200000)

test('Monolithic PDF, no OCR, no pre-header lines', () => {
  return runTest('./test/data/tranche-005/blackbeard.pdf', false)
}, 1200000)
