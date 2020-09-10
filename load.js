const path = require('path')
const ms = require('ms')
const debug = require('debug')('presta')
const assert = require('assert')
const c = require("ansi-colors");

const { log } = require("./lib/log");
const { fileCache } = require('./lib/fileCache')

const requests = new Map();
const memoryCache = {};
const skipLoaders = [];

function getFromFileCache(key) {
  const entry = fileCache.getKey(key);
  const now = Date.now();

  if (entry) {
    const { expires } = entry;

    if (now > expires) {
      debug(`{ ${key} } has expired on disk`);
      fileCache.removeKey(key);
      return undefined;
    } else {
      debug(`{ ${key} } is cached to disk`);
      return entry;
    }
  }
}

export function prime(value, options) {
  const { key, duration } = options;

  assert(!!key, "prime requires a key");

  if (duration) {
    const interval = ms(duration);
    const now = Date.now();

    fileCache.setKey(key, {
      value,
      expires: now + interval,
      duration,
    });

    //fileCache.save(true) // TODO will this break?

    debug(`{ ${key} } has been primed to disk for ${duration}`);
  } else {
    memoryCache[key] = value;
    debug(`{ ${key} } has been primed to memory`);
  }
}

export function expire(key) {
  fileCache.removeKey(key);
  fileCache.save(true)
}

export async function cache(loading, options) {
  const { key, duration } = options;

  assert(!!key, "presta/load cache expects a key");
  assert(duration !== undefined, "presta/load cache expects a duration");

  const interval = ms(duration);

  const entry = getFromFileCache(key);
  if (entry) return entry.value;

  const value = await (typeof loading === "function" ? loading() : loading);

  fileCache.setKey(key, {
    value,
    expires: Date.now() + parseInt(interval),
    duration,
  });

  fileCache.save(true);

  debug(`{ ${key} } has been cached to disk for ${duration}`);

  return value;
}

export function load(loader, options = {}) {
  const { key, duration } = options;
  const cacheToFile = !!duration;

  assert(!!key, "presta/load cache expects a key");

  if (skipLoaders.indexOf(key) > -1) {
    debug(`{ ${key} } threw on last render, skipping...`)
    return null;
  }

  const entry = cacheToFile ? getFromFileCache(key) : memoryCache[key];

  if (entry) {
    if (cacheToFile && duration !== entry.duration) {
      prime(entry.value, { key, duration });
    }

    return cacheToFile ? entry.value : entry;
  }

  async function run() {
    try {
      const loading = loader();
      requests.set(key, loading);

      if (cacheToFile) {
        cache(loading, { key, duration });
      }

      const res = await loading

      requests.delete(key);

      if (!cacheToFile) {
        memoryCache[key] = res;
        debug(`{ ${key} } has been cached in memory`);
      }
    } catch (e) {
      debug(`{ ${key} } threw an error: ${e.message}`);
      requests.delete(key);

      skipLoaders.push(key)

      if (cacheToFile) {
        expire(key)
      }

      log(`\n  ${c.red('error')} load { ${key} }\n\n${e}\n`)
    }
  }

  run()
}

export async function render(component, ctx, renderer = (fn, ctx) => fn(ctx)) {
  const body = renderer(component, ctx);

  if (!!requests.size) {
    await Promise.allSettled(Array.from(requests.values()));
    return render(component, ctx, renderer);
  }

  if (requests.size) {
    throw new Error(
      `presta/load - unresolved requests: ${JSON.stringify(
        Array.from(requests.keys())
      )}`
    );
  }

  return {
    ...ctx,
    body: body + (ctx.body || ""),
    data: {
      ...memoryCache,
      ...fileCache.all(),
      ...(ctx.data || {}),
    },
  };
}
