const YoutubeDownloader = require('youtube-dl');
const FS = require('fs');
const Path = require('path');

module.exports = class DownloadStream {

  /**
   * @param {import('../Downloader')} downloader
   * @param {*} item
   */
  constructor(downloader, item) {
    this._downloader = downloader;
    this._item = item;
    this._info = null;
    this._fullinfo = null;
    this._output = null;
    this._promise = null;
    this._convert = null;
    this._stream = null;
  }

  /**
   * @returns {import('../Downloader')}
   */
  get downloader() {
    return this._downloader;
  }

  get item() {
    return this._item;
  }

  /**
   * @returns {import('events').EventEmitter}
   */
  get events() {
    return this._events;
  }

  get info() {
    return this._info;
  }

  /**
   * @returns {import('youtube-dl').Youtubedl}
   */
  get stream() {
    return this._stream;
  }

  /**
   * @returns {import('fluent-ffmpeg').FfmpegCommand}
   */
  get convert() {
    return this._convert;
  }

  get output() {
    return this._output;
  }

  /**
   * @returns {Promise<DownloadStream>}
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

  setOutput(path = null) {
    if (path !== null) {
      if (Path.isAbsolute(path)) {
        this._output = path;
      } else {
        this._output = Path.join(process.cwd(), path);
      }
    }
    return this;
  }

  getFullInfo() {
    if (this._fullinfo === null) {
      return new Promise((resolve, reject) => {
        YoutubeDownloader.getInfo(this.item.url, null, null, (err, info) => {
          if (err) {
            reject(err);
          } else {
            this._fullinfo = info;
            resolve(info);
          }
        });
      });
    } else {
      return Promise.resolve(this._fullinfo);
    }
  }

  getSize() {
    if (this.info) {
      return this.info.size;
    }
    return null;
  }

  onInfo(info) {
    this._info = info;
  }

  download() {
    this._stream = YoutubeDownloader(this.item.url, [], { cwd: process.cwd() });
    this.stream.on('info', this.onInfo.bind(this));
    return this;
  }

  toFile(output = null) {
    this.setOutput(output);
    const ws = FS.createWriteStream(this.output);

    ws.on('finish', this.onFinish.bind(this));
    this.stream.pipe(ws);
    return this;
  }

  toConvert(output = null) {
    this.setOutput(output);
    this._convert = this.downloader.converter(this.stream);

    this._convert.on('end', this.onFinish.bind(this));
    this._convert.on('error', () => { });
    this._convert.save(this.output);
    return this;
  }

  onFinish() {
    if (this._promise !== null) {
      this._promise.resolve(this);
    }
  }

}
