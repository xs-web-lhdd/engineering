#!/usr/bin/env node


// 入口文件
// const importLocal = require('import-local')
// const { log } = require('@liu/utils')
// const entry = require('../lib/index')

import importLocal from "import-local"
// import { fileURLToPath } from 'node:url'
import { filename } from 'dirname-filename-esm'
import { log } from "@liu/utils";
import entry from "../lib/index.js";

// const __filename = fileURLToPath(import.meta.url)

const __filename = filename(import.meta)

if (importLocal(__filename)) {
  log.info('cli', '本次使用 liu-cli 版本')
} else {
  entry(process.argv.slice(2))
}