const Path = require('path');
const CliProgress = require('cli-progress');

const Format = require('utils/src/Format');
const BulkDownload = require('downloadutils/src/BulkDownload');
const CLILine = require('inputtools/src/logging/CLILine');

module.exports = class DownloadLogger {

  /**
   *
   * @param {BulkDownload} download
   */
  constructor(download) {
    this._download = download;
    this._progress = null;
    this._bars = [];
    this._total = 0;

    this._cliline = {
      overview: new CLILine('Progress: {bar} {percentage} | {from} / {total} Files | {bytes}'),
      download: new CLILine('{title<3}{ext} {bar} {percentage} | {from} / {total}'),
    };

    this._download.promise.then(this.onClose.bind(this));
    this.init();
  }

  /**
   * @returns {BulkDownload}
   */
  get download() {
    return this._download;
  }

  /**
   * @returns {import('cli-progress').SingleBar[]}
   */
  get bars() {
    return this._bars;
  }

  init() {
    this._progress = new CliProgress.MultiBar({
      format: this.format.bind(this),
    });
    for (let i = 0; i < this.download.bulk + 1; i++) {
      this._bars.push(this._progress.create((i === 0 ? this.download.data.length : 1), 0, {
        type: (i === 0 ? 'overview' : 'download'),
        title: 'Waiting …',
        bytes: 0,
      }));
    }

    this.download.events.on('next', this.onNext.bind(this));
    this.download.events.on('finish', this.onFinish.bind(this));
  }

  format(options, params, payload) {
    const line = this._cliline[payload.type];
    const placeholders = {};

    placeholders.bar = '[' + options.barCompleteString.substr(0, Math.round(params.progress * options.barsize));
    placeholders.bar += options.barIncompleteString.substr(placeholders.bar.length) + ']';
    if (payload.title) {
      placeholders.ext = Path.extname(payload.title);
      placeholders.title = Path.basename(payload.title).substr(0, Path.basename(payload.title).length - placeholders.ext.length);
    }
    placeholders.percentage = Format.pad(Math.round(params.progress * 100) || '0', 3, ' ', true) + '%';
    placeholders.from = params.value;
    placeholders.total = params.total;
    placeholders.bytes = Format.fileSize(payload.bytes);

    if (payload.type !== 'overview') {
      placeholders.from = Format.fileSize(placeholders.from);
      placeholders.total = Format.fileSize(placeholders.total);
    }
    return line.format(placeholders);
  }

  /**
   * @param {import('downloadutils/src/BulkDownload').T_DownloadItem} item
   */
  onNext(item) {
    item.download._downloadstream.on('info', this.onInfo.bind(this, item));
    item.download._downloadstream.on('data', (buffer) => this.onData(item, buffer));
  }

  /**
   * @param {import('downloadutils/src/BulkDownload').T_DownloadItem} item
   */
  onFinish(item) {
    this.bars[0].increment();
    this.bars[item.bulkID + 1].stop();
  }

  /**
   * @param {import('downloadutils/src/BulkDownload').T_DownloadItem} item
   */
  onInfo(item) {
    this.bars[item.bulkID + 1].start(item.download.getSize(), 0, {
      type: 'download',
      title: item.download.target,
    });
  }

  /**
   * @param {import('downloadutils/src/BulkDownload').T_DownloadItem} item
   */
  onData(item, buffer) {
    this._total += buffer.length;
    this.bars[0].update(this.bars[0].value, { bytes: this._total });
    this.bars[item.bulkID + 1].increment(buffer.length);
  }

  onClose() {
    for (const bar of this.bars) {
      bar.stop();
    }
    this._progress.stop();
  }

}