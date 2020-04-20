/**
 * @typedef T_DownloadItem
 * @property {string} url
 * @property {boolean} convert
 * @property {string} output
 * @property {boolean} finished
 * @property {string} file
 */

const Path = require('path');
const FS = require('fs');
const CliProgress = require('cli-progress');

module.exports = class BulkDownload {

  /**
   * @param {import('./Downloader')} downloader
   * @param {T_DownloadItem[]} data
   * @param {number} bulk
   */
  constructor(downloader, data, bulk = 5) {
    this._downloader = downloader;
    this._data = data;
    this._bulk = bulk;

    this._logger = null;
    this._bars = [];
    this._index = null;
    this._cwd = process.cwd();

    this._promise = null;
  }

  /**
   * @returns {import('./Downloader')}
   */
  get downloader() {
    return this._downloader;
  }

  /**
   * @returns {import('cli-progress').MultiBar}
   */
  get logger() {
    return this._logger;
  }

  /**
   * @returns {import('cli-progress').SingleBar[]}
   */
  get bars() {
    return this._bars;
  }

  /**
   * @returns {T_DownloadItem[]}
   */
  get data() {
    return this._data;
  }

  /**
   * @returns {Promise<BulkDownload>}
   */
  get promise() {
    if (this._promise === null) {
      this._promise = {};
      this._promise.promise = new Promise((resolve, reject) => {
        this._promise.resolve = resolve;
        this._promise.reject = reject;
      });
    }
    return this._promise.promise;
  }

  setCWD(path) {
    if (!Path.isAbsolute(path)) {
      path = Path.join(process.cwd(), path);
    }
    this._cwd = path;
    return this;
  }

  createLogging() {
    this._logger = new CliProgress.MultiBar({
      format: '{title} [{bar}] {percentage}% | {value} KB / {total} KB',
    });
    this._bars = [];
    for (let i = 0; i < this._bulk + 1; i++) {
      this.bars.push(this.logger.create(1, 0, {
        title: this.getTitle('Waiting ...'),
      }));
    }
    const copy = JSON.parse(JSON.stringify(this.bars[0].options));
    copy.format = 'Download: [{bar}] {percentage}% | {value} / {total} Files';
    this.bars[0].options = copy;
    this.bars[0].start(this.data.length, 0);
  }

  execute() {
    this.createLogging();

    for (let i = 0; i < this._bulk; i++) {
      this.next(i + 1);
    }

    return this;
  }

  async next(id) {
    this.bars[id].stop();
    if (this._data.length <= this._index) return this.finish();
    const data = this._data[this._index++];
    const stream = this.downloader.create(data.url);

    if (data.output === null || data.output === undefined) {
      const fullinfo = await stream.getFullInfo();

      data.output = fullinfo._filename;
    }
    data.file = this.getFile(data);
    data.finished = false;

    if (FS.existsSync(data.file)) {
      data.finished = true;
      this.bars[0].increment();
      this.next(id);
      return;
    }

    stream.download();
    if (data.convert) {
      stream.toConvert(data.file);
    } else {
      stream.toFile(data.file);
    }

    stream.stream.on('info', this.onStart.bind({ that: this, id, stream, data }));
    stream.stream.on('data', this.onUpdate.bind({ that: this, id, stream, data }));
    stream.promise.then(() => {
      data.finished = true;
      this.bars[0].increment();
      this.next(id);
    });
  }

  finish() {
    for (const item of this.data) {
      if (!item.finished) return this;
    }
    if (this._promise) {
      this._promise.resolve(this);
    }
    for (const bar of this.bars) {
      bar.stop();
    }
    this.logger.stop();
    return this;
  }

  onStart() {
    this.that.bars[this.id].start(Math.ceil(this.stream.getSize() / 1024), 0, {
      title: this.that.getTitle(Path.basename(this.data.output)),
    });
  }

  onUpdate(buffer) {
    this.that.bars[this.id].increment(Math.ceil(buffer.length / 1024));
  }

  /**
   * @param {string} title
   */
  getTitle(title) {
    if (title.length > 15) {
      return title.substring(0, 15);
    }
    return title + ' '.repeat(15 - title.length);
  }

  getFile(data) {
    let output = data.output;

    if (typeof data.convert === 'string') {
      if (Path.extname(data.output) !== data.convert) {
        output = output.substring(0, output.length - Path.extname(data.output).length) + '.' + data.convert;
      }
    }

    if (Path.isAbsolute(output)) {
      return output;
    } else {
      return Path.join(this._cwd, output);
    }
  }

}
