/**
 * @typedef T_DownloadItem
 * @property {string} url
 * @property {boolean} convert
 * @property {string} output
 * @property {boolean} finished
 * @property {string} file
 * @property {Error} error
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

    this._promise = {};
    this._promise.promise = new Promise((resolve, reject) => {
      this._promise.resolve = resolve;
      this._promise.reject = reject;
    });
    this._total = 0;
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
    return this._promise.promise;
  }

  setCWD(path) {
    if (!Path.isAbsolute(path)) {
      path = Path.join(process.cwd(), path);
    }
    this._cwd = path;
    return this;
  }

  getFormatter(options, params, payload) {
    const overview = (payload.type === 'overview');
    let bar = options.barCompleteString.substr(0, Math.round(params.progress * options.barsize));
    bar += options.barIncompleteString.substr(bar.length);
    const parts = [];
    if (overview) {
      parts.push('Download:');
    } else {
      parts.push(this.formatFile(payload.title));
    }
    parts.push('[' + bar + ']');
    parts.push(this.pad(Math.round(params.progress * 100) || '0', 3, ' ', true) + '%');
    parts.push('|');
    if (overview) {
      parts.push(params.value + ' / ' + params.total + ' Files');
      parts.push('| ' + this.formatFileSize(payload.totalSize));
    } else {
      parts.push(this.formatFileSize(params.value) + ' / ' + this.formatFileSize(params.total));
    }
    return parts.join(' ');
  }

  formatFile(file) {
    const absolute = Path.isAbsolute(file);
    file = Path.basename(file);
    if (!absolute || file.length <= 25) return this.pad(file, 25);
    const ext = Path.extname(file);

    return file.substring(0, 24 - ext.length) + '…' + ext;
  }

  formatFileSize(bytes) {
    var thresh = 1000;
    if (Math.abs(bytes) < thresh) {
      return this.pad(bytes + ' B', 8, ' ', true);
    }
    var units = ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    var u = -1;
    do {
      bytes /= thresh;
      ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return this.pad(bytes.toFixed(1) + ' ' + units[u], 8, ' ', true);
  }

  createLogging() {
    this._logger = new CliProgress.MultiBar({
      format: this.getFormatter.bind(this),
    });
    this._bars = [];
    for (let i = 0; i < this._bulk + 1; i++) {
      this.bars.push(this.logger.create(1, 0, {
        title: 'Waiting ...',
      }));
    }
    this.bars[0].start(this.data.length, 0, {
      type: 'overview',
      totalSize: 0,
    });
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
      try {
        const fullinfo = await stream.getFullInfo();

        data.output = fullinfo._filename;
      } catch (e) {
        data.error = e;
        data.finished = true;
        this.bars[0].increment();
        this.next(id);
        return;
      }
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
    this._promise.resolve(this);
    for (const bar of this.bars) {
      bar.stop();
    }
    this.logger.stop();
    return this;
  }

  onStart() {
    this.that.bars[this.id].start(this.stream.getSize(), 0, {
      title: this.data.file,
    });
  }

  onUpdate(buffer) {
    this.that._total += buffer.length;
    console.log()
    this.that.bars[0].update({ totalSize: this.that._total });
    this.that.bars[this.id].increment(buffer.length);
  }

  pad(string, length, padding = ' ', left = false) {
    string = string && string + '' || '';
    if (string.length > length) return string.substring(0, length);
    const pad = padding.repeat(length - string.length);
    if (left) {
      return pad + string;
    } else {
      return string + pad;
    }
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
