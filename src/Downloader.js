const Converter = require('fluent-ffmpeg');
const FFMpegSource = require('@ffmpeg-installer/ffmpeg');

Converter.setFfmpegPath(FFMpegSource.path);

const BulkDownload = require('./BulkDownload');
const DownloadStream = require('./streams/DownloadStream');

module.exports = class Downloader {

  /**
   * @param {import('inputtools/src/logging/Logger')} logger
   */
  constructor(logger) {
    this._logger = logger;
  }

  /**
   * @returns {import('inputtools/src/logging/Logger')}
   */
  get logger() {
    return this._logger;
  }

  get converter() {
    return Converter;
  }

  createMulti(data, bulk = 5) {
    return new BulkDownload(this, data, bulk);
  }

  create(url) {
    return new DownloadStream(this, { url });
  }

}
