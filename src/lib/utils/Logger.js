const path = require('path')
const winston = require('winston')

let _logger = null

function init (dir) {
  let logfile = path.join(dir, 'mailshredder.log')

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
        filename: logfile
      })
    ]
  })
}

function getLogger () {
  return _logger
}

module.exports = {
  init: init,
  getLogger: getLogger
}
