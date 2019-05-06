
const fs = require('fs')
var path = require('path')

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

function ucFirst (string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

// FIXME -- this is a total hack:
//    - it has a hard-coded list of directories
//    - it won't work on windows
//    - it doesn't even check to see if a file is executable
//
// I tried using the command-exists npm module, but when the app is compiled and
// run from the finder, the PATH is apparently not set, so commnd-exists can't find
// any of the executables (and I suspect we wouldn't be able to run the commands, either)
function findExecutable (store, executable, key, name) {
  let dirs = [
    '/bin',
    '/usr/bin',
    '/usr/local/bin',
    '/opt/local/bin'
  ]
  for (let i = 0; i < dirs.length; i++) {
    let dir = dirs[i]
    let fullPath = path.join(dir, executable)
    if (fs.existsSync(fullPath)) {
      key = 'commands/update' + ucFirst(key)
      store.commit(key, fullPath)
      console.log(`found ${executable}: ${fullPath}`)
      return true
    }
  }
  console.log(`could not find ${executable}`)
  return false
}

module.exports = {
  isDir,
  isDirEmpty,
  ensureDirectoryExists,
  findExecutable
}
