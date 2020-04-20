#!/usr/bin/env node

const { program } = require('commander');
const Downloader = require('../src/Downloader');
const FS = require('fs');
const Path = require('path');
const manager = new Downloader();

program
  .arguments('[url] [target]')
  .option('-j|--json [file]')
  .option('-l|--list [file]')
  .option('-o|--cwd [path]')
  .option('-c|--convert [format]')
  .option('-b|--bulk [bulk]', '', 5)
  .action(async (url = null, target = null, options) => {
    if (url) {
      const bulk = manager.createMulti([
        {
          url: url,
          output: target,
          convert: options.convert || false,
        }
      ], 1);
      if (options.cwd) {
        bulk.setCWD(options.cwd);
      }
      await bulk.execute().promise;
      console.log('FINISHED');
      process.exit();
    } else {
      let data = [];
      if (options.json) {
        if (Path.isAbsolute(options.json)) {
          data = require(options.json);
        } else {
          data = require(Path.join(process.cwd(), options.json));
        }
      } else if (options.list) {
        const list = FS.readFileSync(options.list);

        for (const line of list.toString().split("\n")) {
          if (line.trim().length === 0) continue;
          data.push({
            url: line,
            convert: options.convert || false,
          });
        }
      }

      const bulk = manager.createMulti(data, parseInt(options.bulk));
      if (options.cwd) {
        bulk.setCWD(options.cwd);
      }
      await bulk.execute().promise;
      console.log('FINISHED');
      process.exit();
    }
  }).parse(process.argv);
