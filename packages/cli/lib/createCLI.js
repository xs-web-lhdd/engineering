import path from 'node:path'
import { program } from 'commander'
import { dirname } from 'dirname-filename-esm'
import fse from 'fs-extra'
import semver from 'semver'
import { log } from '@liu/utils'

const __dirname = dirname(import.meta)
const pkgPath = path.resolve(__dirname, '../package.json')
const pkg = fse.readJSONSync(pkgPath)


const LOWEST_NODE_VERSION = '12.0.0'

function checkNodeVersion() {
  if (!semver.gte(process.version, LOWEST_NODE_VERSION)) {
    throw new Error(`liu-cli 需要安装 ${LOWEST_NODE_VERSION} 以上版本的 Node.js`)
  }
}

function preAction() {
  // 检查 Node 版本
  checkNodeVersion()
}


export default function createCLI () {
  log.info('version', pkg.version)

  program
    .name(Object.keys(pkg.bin)[0])
    .usage('<command> [options]')
    .version(pkg.version)
    .option('-d, --debug', '是否开启调试模式', false)
    .hook('preAction', preAction)

    // 踩坑：option:debug 中间没有空格
    program.on('option:debug', function () {
      if (program.opts().debug) {
        log.verbose('debug', 'launch debug mode')
      }
    })
    // 监听未知 command
    program.on('command:*', function (obj) {
      log.error('未知的命令: ' + obj[0])
    })

  return program
}