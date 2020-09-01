require("core-js/stable");
require("regenerator-runtime/runtime");

const fs = require("fs-extra");
const path = require("path");
const chokidar = require("chokidar");
const { difference } = require("lodash");
const onExit = require("exit-hook");
const c = require("ansi-colors");
const debug = require("debug")("presta");

const { PRESTA_PAGES } = require("./lib/constants");
const { isStaticallyExportable } = require("./lib/isStaticallyExportable");
const { encodeFilename } = require("./lib/encodeFilename");
const { getValidFilesArray } = require("./lib/getValidFilesArray");
const { createCompiler } = require("./lib/compiler");
const { createEntries } = require("./lib/createEntries");
const { ignoreArray } = require("./lib/ignore");
const fileHash = require("./lib/fileHash");
const { pathnameToHtmlFile } = require("./lib/pathnameToHtmlFile");
const { safeConfigFilepath } = require("./lib/safeConfigFilepath");

let renderQueue = [];

async function renderEntries(entries, options = {}) {
  const { incremental = true, output, build = false } = options;

  let pagesWereRendered = false;

  debug("render", entries);

  await Promise.all(
    entries.map(async (entry) => {
      // was previously configured, remove so that it can re-render if reconfigured
      if (!isStaticallyExportable(entry.sourceFile)) {
        fileHash.remove(entry.id);
        return;
      }

      const nextRev = fileHash.hash(entry.compiledFile);
      const fileFromHash = fileHash.get(entry.id);
      const pagesFromHashedFile = fileFromHash ? fileFromHash.pages : [];

      // get paths
      const { getPaths, render, prepare } = require(entry.compiledFile);
      const paths = await getPaths();

      const revisionMismatch =
        incremental && fileFromHash ? fileFromHash.rev !== nextRev : true;
      const newPages = paths.filter((p) => {
        return pagesFromHashedFile.indexOf(p) < 0;
      });

      // remove non-existant paths
      if (fileFromHash) {
        fileFromHash.pages
          .filter((p) => {
            return paths.indexOf(p) < 0;
          })
          .forEach((page) => {
            fs.removeSync(path.join(output, pathnameToHtmlFile(page)));
          });
      }

      debug(`${entry.id} updated`, !!revisionMismatch);
      debug(`${entry.id} has new pages`, !!newPages.length);

      if (revisionMismatch || !!newPages.length) {
        const pages = revisionMismatch ? paths : newPages;

        pages.forEach(async (pathname) => {
          renderQueue.push({
            entry,
            pathname,
            render: async () => {
              const file = path.join(output, pathnameToHtmlFile(pathname));
              const result = await render({
                pathname,
                head: { title: "", style: [], meta: [] },
              });

              fs.outputFileSync(file, prepare(result), "utf-8");
            },
          });
        });

        fileHash.set(entry.id, nextRev, {
          pages: paths,
        });

        fileHash.save();

        pagesWereRendered = true;
      }
    })
  ).catch((e) => {
    console.log("\n\n");
    console.log("render error", e);
    console.log("\n\n");
  });

  while (renderQueue.length) {
    const { pathname, render, entry } = renderQueue.pop();

    try {
      const st = Date.now();
      await render();
      const time = Date.now() - st;
      console.log(`  ${c.gray(time + "ms")}\t${pathname}`);
      delete require.cache[entry.compiledFile];
    } catch (e) {
      console.log('\n\n')
      console.log(`  ${c.red('error')}  ${pathname}`)
      console.log('\n\n')
      console.error(e)
      console.log('\n\n')
      console.log(c.gray('  errors detected, pausing...'))
      console.log('\n\n')

      // important, reset this for next pass
      renderQueue = []

      break;
    }
  }

  if (build && !pagesWereRendered) {
    console.log("no changes detected, exiting...");
  }
}

async function watch(config) {
  let filesArray = getValidFilesArray(config.input);
  let entries = createEntries({
    filesArray,
    baseDir: config.baseDir,
    configFilepath: config.configFilepath,
    runtimeFilepath: config.runtimeFilepath,
  });
  debug("entries", entries);
  let stopCompiler = createCompiler(entries).watch(compilerCallback);

  function compilerCallback(err, pages) {
    if (err) {
      console.error("compiler issue", err);
    }

    // match entries to emitted pages
    const entriesToUpdate = entries
      .filter((e) => {
        return pages.find((p) => p[0].indexOf(e.id) > -1);
      })
      .map((e) => {
        return {
          ...e,
          compiledFile: pages.find((p) => p[0].indexOf(e.id) > -1)[1],
        };
      });

    renderEntries(entriesToUpdate, {
      output: config.output,
      incremental: config.incremental,
    });
  }

  chokidar
    .watch(config.baseDir, {
      ignore: ignoreArray,
      ignoreInitial: true,
    })
    .on("all", async (ev, p) => {
      let shouldRestart = false;

      const filename = p.replace(config.baseDir, "");

      /*
       * sometimes need to "create" a dummy entry, say in the case of a filename
       * letter case change or rename, so that it can be compared against what it
       * was named previously
       */
      const entry = entries.find((entry) => entry.sourceFile === p) || {
        id: encodeFilename(filename),
      };

      const potentiallyRenamedFileID = fileHash.keys().find((key) => {
        return key.toLowerCase() === entry.id.toLowerCase();
      });
      const wasRenamed = potentiallyRenamedFileID && !fileHash.get(entry.id);

      if (wasRenamed) {
        fileHash.remove(potentiallyRenamedFileID);
      }

      if (wasRenamed || /add|unlink/.test(ev)) {
        if (ev === "unlink") {
          const { pages = [] } = fileHash.get(entry.id);

          // remove built pages
          pages.forEach((page) => {
            fs.removeSync(path.join(config.output, pathnameToHtmlFile(page)));
          });

          fileHash.remove(entry.id);
        }

        shouldRestart = true;
      } else if (ev === "change") {
        const previouslyInvalid =
          !fileHash.get(entry.id) && isStaticallyExportable(p);
        // const nowInvalid = fileHash[entry.id] && !isStaticallyExportable(p)

        if (previouslyInvalid) shouldRestart = true;
        // if (nowInvalid) {
        //   fs.removeSync(path.join(pagesTmp, entry.id + '.js'))
        // }
      }

      if (shouldRestart) {
        await stopCompiler();

        filesArray = getValidFilesArray(config.input);
        entries = createEntries({
          filesArray,
          baseDir: config.baseDir,
          configFilepath: config.configFilepath,
          runtimeFilepath: config.runtimeFilepath,
        });
        stopCompiler = createCompiler(entries).watch(compilerCallback);
      }
    });
}

async function build(config) {
  const filesArray = getValidFilesArray(config.input);
  const entries = createEntries({
    filesArray,
    baseDir: config.baseDir,
    configFilepath: config.configFilepath,
    runtimeFilepath: config.runtimeFilepath,
  });
  debug("entries", entries);

  return new Promise((res, rej) => {
    createCompiler(entries).build(async (err, pages) => {
      if (err) rej(err);

      // match entries to emitted pages
      const entriesToUpdate = entries
        .filter((e) => {
          return pages.find((p) => p[0].indexOf(e.id) > -1);
        })
        .map((e) => {
          return {
            ...e,
            compiledFile: pages.find((p) => p[0].indexOf(e.id) > -1)[1],
          };
        });

      await renderEntries(entriesToUpdate, {
        build: true,
        incremental: config.incremental,
        output: config.output,
      });

      res();
    });
  });
}

module.exports = {
  watch,
  build,
};