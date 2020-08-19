#!/usr/bin/env node

require('esm')(module)

const path = require("path");
const fs = require('fs-extra')
const assert = require('assert')

const { watch, build } = require('./')
const { CWD, PRESTA_DIR, PRESTA_PAGES, PRESTA_WRAPPED_PAGES } = require('./lib/constants')
const { getGlobCommonDirectory } = require('./lib/getGlobCommonDirectory')
const { safeConfigFilepath } = require('./lib/safeConfigFilepath')
const { safeRequire } = require('./lib/safeRequire')

const args = require('minimist')(process.argv.slice(2))
const [ command ] = args._

const configFilepath = safeConfigFilepath(args.c || args.config || 'presta.config.js')
const configFile = safeRequire(configFilepath, {})
const input = args.i || args.in || configFile.input
const output = args.o || args.out || configFile.output || 'build'
const incremental = args.inc || args.incremental || configFile.incremental || false

assert(!!input, `presta - please provide an input`)

const config = {
  command,
  input,
  output: path.join(CWD, output),
  baseDir: path.resolve(CWD, getGlobCommonDirectory(input)),
  configFilepath,
  incremental,
}

fs.ensureDir(PRESTA_DIR);
fs.emptyDirSync(PRESTA_PAGES);
fs.emptyDirSync(PRESTA_WRAPPED_PAGES);

;(async () => {
  if (command === "watch") {
    console.log('watching')
    watch(config);
  } else if (command === "build") {
    console.log('building')
    console.time('build')
    await build(config)
    console.timeEnd('build')
  }
})();