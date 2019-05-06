const os = require('os')
const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
import MultiplePdfReader from '../../../src/lib/readers/MultiplePdfReader'
import PDFUtils from '../../../src/lib/utils/PDFUtils'
import Logger from '../../../src/lib/utils/Logger'
const ensureDirectoryExists = require('../../../src/lib/utils/Filesystem').ensureDirectoryExists

let testOutDir = path.join(os.tmpdir(), 'mailshredder-test')

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
    // fs.writeFileSync(path.join(testDir, 'actual.json'), emailStr)
    expect(emailStr).toBe(expectedEmailStr)
  })
}

test('Multiple PDFs, no OCR', () => {
  return runTest('./test/data/tranche-001/', false, false)
}, 1200000)

test('Single PDF Portfolio', () => {
  return runTest('./test/data/tranche-002/Greensboro-response-opt.pdf', false, true)
}, 1200000)

test('Multiple PDFs, OCR', () => {
  return runTest('./test/data/tranche-003/', true, false)
}, 1200000)
