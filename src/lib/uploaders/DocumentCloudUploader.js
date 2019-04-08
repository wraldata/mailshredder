const DocumentCloudClient = require('electron').remote.require('documentcloud')
const pathinfo = require('pathinfo')
const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')
const flatten = require('q-flat').flatten

let DocumentCloudUploader = function (params) {
  let _self = new EventEmitter()

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

  let _client = new DocumentCloudClient(_options.username, _options.password)

  _self.validateProjectId = function (projectId) {
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
            recordResult(file, false)
            reject(new Error('Unexpected status code: ' + response.status_code))
          }

          recordResult(file, true)
          resolve(true)
        })
      } catch (err) {
        recordResult(file, false)
        console.error(err)
        throw new Error('Error uploading to Document Cloud: ' + err.message)
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
    all: [],
    success: [],
    fail: []
  }

  function recordResult (f, success) {
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

    _self.emit('upload-success', f)
  }

  _self.uploadFiles = function (files) {
    _files.all = JSON.parse(JSON.stringify(files))
    _files.count = _files.all.length
    _files.success = []
    _files.fail = []
    _files.updateAt = Math.max(parseInt(_files.count / 20), 1)

    return Promise.all(_files.all.map(function (f) {
      let pi = pathinfo(f)
      let data = getMetaData(f)
      return uploadFile(f, pi.basename, data)
    }))
  }

  return _self
}

export default DocumentCloudUploader
