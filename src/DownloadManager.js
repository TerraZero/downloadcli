const FS = require('fs');
const Path = require('path');

const Download = require('downloadutils/src/Download');
const BulkDownload = require('downloadutils/src/BulkDownload');

module.exports = class DownloadManager {

  /**
   * @param {string} path
   * @returns {import('downloadutils/src/BulkDownload').T_DownloadItem}
   */
  static readFromFile(path) {
    const items = [];
    const list = FS.readFileSync(path);

    for (const url of list.toString().split("\n")) {
      if (url.trim().length === 0) continue;
      items.push({ url });
    }
    return items;
  }

  /**
   * @param {string} path
   * @returns {import('downloadutils/src/BulkDownload').T_DownloadItem}
   */
  static readFromJSON(path) {
    if (Path.isAbsolute(path)) {
      return require(path);
    } else {
      return require(Path.join(process.cwd(), path));
    }
  }

  /**
   * @param {(import('downloadutils/src/BulkDownload')|import('downloadutils/src/Download'))} download
   * @returns {import('downloadutils/src/BulkDownload').T_DownloadItem[]}
   */
  static extractErrors(download) {
    if (download instanceof Download) {
      if (download.error) {
        return [
          download.item,
        ];
      }
    } else {
      const errors = [];

      for (const item of download.data) {
        if (item.download.error) {
          errors.push(item);
        }
      }
      return errors;
    }
  }

}
