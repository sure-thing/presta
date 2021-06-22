import fs from 'fs'
import path from 'path'

import * as fixtures from './fixtures'

import { hash, extract } from '../lib/extract'
import { createConfig, getCurrentConfig, Env } from '../lib/config'

export default (test, assert) => {
  test('extract', async () => {
    createConfig({
      env: Env.TEST,
      configFile: { output: path.join(fixtures.getRoot(), 'extract') }
    })

    const config = getCurrentConfig()

    extract('content', 'txt', 'extracted')

    // only in TEST env will this match, otherwise will be `extracted-[hash].txt
    const content = fs.readFileSync(
      path.join(config.staticOutputDir, 'extracted.txt'),
      'utf8'
    )

    assert(content === 'content')
  })

  test('extract - hash', async () => {
    assert(hash('test') === hash('test'))
  })
}