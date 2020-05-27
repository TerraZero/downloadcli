#!/usr/bin/env node

const { program } = require('commander');

const Logger = require('clitools/src/logging/Logger');
const BulkDownload = require('downloadutils/src/BulkDownload');
const DownloadManager = require('../src/DownloadManager');
const DownloadLogger = require('../src/DownloadLogger');

program
  .arguments('[url] [target]')
  .option('-j|--json [file]', 'Path to a json file. (Only useable without argument "url")')
  .option('-l|--list [file]', 'Path to a file of url`s. (Only useable without argument "url")')
  .option('-o|--cwd [path]', 'Path to the cwd for the download. (Can be overwritten from single download item)')
  .option('-c|--convert [format]', 'The convert extname. (Only useable with argument "url")')
  .option('--overwrite', 'If the files should be overwritten by download.')
  .option('-b|--bulk [bulk]', 'The number of processes.', 5)
  .action(async function (url = null, target = null, options) {
    const logger = new Logger('download-cli');
    if (url) {
      const bulk = new BulkDownload([{
        url: url,
        output: target,
        convert: options.convert || false,
      }]);

      bulk.setBulk(1);
      if (options.cwd) bulk.setCWD(options.cwd);
      if (options.overwrite) bulk.setOption('overwrite', true);

      new DownloadLogger(bulk);
      await bulk.download().promise;
      const errors = DownloadManager.extractErrors(bulk);

      if (errors.length) {
        logger.failed('FINISHED [total] WITH [length] ERRORS', { total: bulk.data.length, length: errors.length });
        for (const item of errors) {
          console.log(item.download.error);
          logger.error(item.url + ' ' + item.download.error.stderr);
        }
      } else {
        logger.success('FINISHED [total]', { total: bulk.data.length });
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
        this.help();
      }

      const bulk = new BulkDownload(data);

      bulk.setBulk(Number.parseInt(options.bulk));
      if (options.cwd) bulk.setCWD(options.cwd);
      if (options.overwrite) bulk.setOption('overwrite', true);

      new DownloadLogger(bulk);
      await bulk.download().promise;
      const errors = DownloadManager.extractErrors(bulk);

      if (errors.length) {
        logger.failed('FINISHED [total] WITH [length] ERRORS', { total: bulk.data.length, length: errors.length });
        for (const item of errors) {
          logger.error(item.url + ' ' + item.download.error.stderr);
        }
      } else {
        logger.success('FINISHED [total]', { total: bulk.data.length });
      }
      process.exit();
    }
  }).parse(process.argv);
