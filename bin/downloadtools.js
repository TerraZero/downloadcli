#!/usr/bin/env node

const { program } = require('commander');

const Logger = require('clitools/src/logging/Logger');
const BulkDownload = require('downloadutils/src/BulkDownload');
const DownloadManager = require('../src/DownloadManager');
const DownloadLogger = require('../src/DownloadLogger');

program
  .arguments('[url] [target]')
  .option('-j|--json [file]')
  .option('-l|--list [file]')
  .option('-o|--cwd [path]')
  .option('-c|--convert [format]')
  .option('-b|--bulk [bulk]', '', 5)
  .action(async (url = null, target = null, options) => {
    const logger = new Logger('download-cli');
    if (url) {
      const bulk = new BulkDownload([{
        url: url,
        output: target,
        convert: options.convert || false,
      }]);

      bulk.setBulk(1);
      if (options.cwd) {
        bulk.setCWD(options.cwd);
      }
      await bulk.download().promise;
      const errors = DownloadManager.extractErrors(bulk);

      if (errors.length) {
        logger.failed('FINISHED WITH {length} ERRORS', { length: errors.length });
        for (const item of errors) {
          logger.error('ERROR:', item.url, item.download.error.message);
        }
      } else {
        logger.success('FINISHED');
      }
      process.exit();
    } else {
      let data = [];
      if (options.json) {
        data = DownloadManager.readFromJSON(options.json);
      } else if (options.list) {
        data = DownloadManager.readFromFile(options.list);
      } else {
        logger.failed('No data givin.');
        process.exit();
      }

      const bulk = new BulkDownload(data, [], {}, Number.parseInt(options.bulk));

      if (options.cwd) bulk.setCWD(options.cwd);

      new DownloadLogger(bulk);
      await bulk.download().promise;
      const errors = DownloadManager.extractErrors(bulk);

      const errors = DownloadManager.extractErrors(bulk);

      if (errors.length) {
        logger.failed('FINISHED WITH {length} ERRORS', { length: errors.length });
        for (const item of errors) {
          logger.error('ERROR:', item.url, item.download.error.message);
        }
      } else {
        logger.success('FINISHED');
      }
      process.exit();
    }
  }).parse(process.argv);
