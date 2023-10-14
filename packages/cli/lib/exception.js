import { isDebug, log } from '@liu/utils'

function printErrorLog(e, type) {
  if (isDebug()) {
    log.error(type, e)
  } else {
    log.error(type, e.message);
  }
}

process.on('uncaughtException', (e) => printErrorLog(e, 'commonError'))

// 监听 promise 的异常
process.on('unhandledRejection', (e) => printErrorLog(e, 'promiseError'))