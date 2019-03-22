const DocumentCloudClient = require('documentcloud')
const prompt = require('prompt-sync')()
const pathinfo = require('pathinfo')
const path = require('path')
const fs = require('fs')
const flatten = require('q-flat').flatten

let DocumentCloudUploader = function (params) {
  let _options = {
    username: '',
    password: '',
    projectId: null
  }

  if (typeof params === 'undefined') {
    params = {}
  }

  Object.assign(_options, params)

  if (_options.projectId) {
    _options.projectId = parseInt(_options.projectId)
  }

  if (!_options.password) {
    _options.password = prompt.hide('DocumentCloud password: ')
  }

  let _client = new DocumentCloudClient(_options.username, _options.password)

  this.validateProjectId = function (projectId) {
    let promise = new Promise(function (resolve, reject) {
      _client.projects.list(function (err, response) {
        if (err) {
          reject(err)
          return
        }

        if (response.status_code !== 200) {
          reject(new Error('Unexpected status code: ' + response.status_code))
          return
        }

        let projects = response.response.projects

        for (let i = 0; i < projects.length; i++) {
          if (projects[i].id === _options.projectId) {
            resolve(projects[i])
            return
          }
        }
        resolve(false)
      })
    })
    return promise
  }

  function uploadFile (file, title, data) {
    let promise = new Promise(function (resolve, reject) {
      try {
        let opts = {
          project: _options.projectId,
          data: data
        }

        // Object.assign(opts, flatten(data))

        opts = flatten(opts)

        _client.documents.upload(file, title, opts, function (err, response) {
          if (err) {
            reject(err)
            return
          }
          if (response.status_code !== 200) {
            reject(new Error('Unexpected status code: ' + response.status_code))
          }

          resolve(true)
        })
      } catch (err) {
        console.error(err)
        process.exit(1)
      }
    })

    return promise
  }

  function getMetaData (file) {
    let pi = pathinfo(file)
    let metaFilePath = path.join(pi.dirname, pi.basename + '.json')

    let json = fs.readFileSync(metaFilePath, 'utf-8')

    let data = {}
    let minPage = Number.POSITIVE_INFINITY
    if (json) {
      let rawData = JSON.parse(json)
      for (let k in rawData) {
        let header = rawData[k]
        data[header.header] = header.value

        if (header.line.page < minPage) {
          minPage = header.line.page
        }
      }
    }
    data['page'] = minPage

    return data
  }

  let _files = {
    count: 0,
    updateAt: 0,
    unsent: [],
    success: [],
    fail: []
  }

  function getNextFile () {
    if (_files.unsent.length < 1) {
      return null
    }
    return _files.unsent.pop()
  }

  function recordResult (f, success, resolve) {
    if (success) {
      _files.success.push(f)
    } else {
      _files.fail.push(f)
    }

    let numAttempted = _files.success.length + _files.fail.length

    if (numAttempted % _files.updateAt === 0) {
      let percDone = (numAttempted / _files.count * 100.0).toFixed(1)
      console.log('[DocumentCloudUpdater] ' + percDone + '% (' + _files.success.length + ' success, ' + _files.fail.length + ' fail)')
    }

    if (numAttempted >= _files.count) {
      resolve(_files)
    }
  }

  this.uploadFiles = function (files) {
    _files.unsent = JSON.parse(JSON.stringify(files))
    _files.count = _files.unsent.length
    _files.updateAt = Math.max(parseInt(_files.count / 20), 1)

    let promise = new Promise(function (resolve, reject) {
      let f = null
      while ((f = getNextFile()) !== null) {
        let pi = pathinfo(f)

        let data = getMetaData(f)

        console.log(`uploading ${f}...`)
        uploadFile(f, pi.basename, data).then(function () {
          recordResult(f, true, resolve)
        }).catch(function () {
          recordResult(f, false, resolve)
        })
      }
    })
    return promise
  }
}

module.exports = DocumentCloudUploader
