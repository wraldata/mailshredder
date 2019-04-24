const path = require('path')
const winston = require('winston')

let _logger = null
let _logfile = ''

function init (dir) {
  _logfile = path.join(dir, 'mailshredder.log')

  _logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.simple(),
      winston.format.printf(
        info => `${info.timestamp} ${info.level} ${info.message}`
      )
    ),
    transports: [
      new winston.transports.File({
        filename: _logfile
      })
    ]
  })
}

function getLogger () {
  return _logger
}

function getLogfile () {
  return _logfile
}

module.exports = {
  init: init,
  getLogger: getLogger,
  getLogfile: getLogfile
}
