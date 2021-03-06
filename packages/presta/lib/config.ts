import path from 'path'

import * as logger from './log'
import { createEmitter } from './createEmitter'
import { Env, setCurrentPrestaInstance, getCurrentPrestaInstance } from './currentPrestaInstance'

import type { Config, CLI } from '..'

const defaultConfigFilepath = 'presta.config.js'

export { Env }

function resolveAbsolutePaths(config: Config, { cwd }: { cwd: string }) {
  if (config.files) config.files = ([] as string[]).concat(config.files).map((p) => path.resolve(cwd, p))
  if (config.output) config.output = path.resolve(cwd, config.output)
  if (config.assets) config.assets = path.resolve(cwd, config.assets)
  return config
}

/**
 * @private
 */
export function _clearCurrentConfig() {
  // @ts-ignore
  global.__presta__ = {
    pid: process.pid,
    cwd: process.cwd(),
    env: Env.PRODUCTION,
  }
}

/**
 * Fetch a config file. If one was specified by the user, let them know if
 * anything goes wrong. Outside watch mode, this should exit(1) if the user
 * provided a config and there was an error
 */
export function getConfigFile(filepath: string, shouldExit: boolean = false) {
  try {
    return require(path.resolve(filepath || defaultConfigFilepath))
  } catch (e) {
    logger.error({
      label: 'error',
      error: e,
    })

    // we're not in watch mode, exit
    if (shouldExit) process.exit(1)

    return {}
  }
}

/**
 * Creates a new instance _without_ any values provided by the config file.
 * This is used when the user deletes their config file.
 */
export function removeConfigValues() {
  logger.debug({
    label: 'debug',
    message: `config file values cleared`,
  })

  return setCurrentPrestaInstance(
    createConfig({
      ...getCurrentPrestaInstance(),
      config: {},
    })
  )
}

export function createConfig({
  cwd = process.cwd(),
  env = getCurrentPrestaInstance().env,
  config = {},
  cli = {},
}: {
  cwd?: string
  env?: Env
  config?: Partial<Config>
  cli?: Partial<CLI>
}) {
  config = resolveAbsolutePaths({ ...config }, { cwd }) // clone read-only obj
  cli = resolveAbsolutePaths({ ...cli }, { cwd })

  // combined config, preference to CLI args
  const merged = {
    output: path.resolve(cwd, cli.output || config.output || 'build'),
    assets: path.resolve(cli.assets || config.assets || 'public'),
    files: cli.files && cli.files.length ? cli.files : config.files ? ([] as string[]).concat(config.files) : [],
  }

  // set instance
  const current = setCurrentPrestaInstance({
    ...getCurrentPrestaInstance(),
    ...merged, // overwrites every time
    env,
    debug: cli.debug || getCurrentPrestaInstance().debug,
    cwd: cwd || process.cwd(),
    configFilepath: path.resolve(cli.config || defaultConfigFilepath),
    functionsOutputDir: path.join(merged.output, 'functions'),
    staticOutputDir: path.join(merged.output, 'static'),
    routesManifest: path.join(merged.output, 'routes.json'),
    events: createEmitter(),
  })

  if (config.plugins) {
    config.plugins.map((p) => {
      try {
        p()
      } catch (e) {
        logger.error({
          label: 'error',
          error: e,
        })
      }
    })
  }

  logger.debug({
    label: 'debug',
    message: `config created ${JSON.stringify(current)}`,
  })

  return current
}
