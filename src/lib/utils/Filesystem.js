
const fs = require('fs')

function isDirEmpty (path) {
  try {
    let files = fs.readdirSync(path)
    return (files.length < 1)
  } catch (e) {
    throw new Error(`Error: could not determine if "${path}" is empty: ${e.message}`)
  }
}

function isDir (path) {
  try {
    let stat = fs.lstatSync(path)
    return stat.isDirectory()
  } catch (e) {
    // lstatSync throws an error if path doesn't exist
    return false
  }
}

function ensureDirectoryExists (dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }

  if (!isDir(dir)) {
    throw new Error('Error: output directory ' + dir + ' exists, but is not a directory.')
  }
}

module.exports = {
  isDir,
  isDirEmpty,
  ensureDirectoryExists
}
