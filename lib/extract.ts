import fs from 'fs-extra'
import path from 'path'
import assert from 'assert'

import { getCurrentConfig } from './config'

export function hash (content: string) {
  var h = 5381,
    i = content.length

  while (i) h = (h * 33) ^ content.charCodeAt(--i)

  return (h >>> 0).toString(36)
}

export function extract (raw: string, ext: string, key: string) {
  assert(!!raw, 'Nothing to extract')
  assert(!!ext, 'Please specify an extension')
  assert(!!key, 'Please specify a key')

  const { env, staticOutputDir } = getCurrentConfig()
  const PROD = env === 'production'

  const filename = PROD ? key + '-' + hash(raw) : key
  const publicPath = '/' + filename + '.' + ext

  fs.outputFileSync(path.join(staticOutputDir, publicPath), raw)

  return publicPath
}

export function css (raw: string, key: string) {
  return extract(raw, 'css', key)
}

export function js (raw: string, key: string) {
  return extract(raw, 'js', key)
}