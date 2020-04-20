const YoutubeDownloader = require('youtube-dl');
const FFMpegSource = require('@ffmpeg-installer/ffmpeg');
const Con = require('fluent-ffmpeg');

Con.setFfmpegPath(FFMpegSource.path);

const video = YoutubeDownloader('https://www.youtube.com/watch?v=5T7po_Nw9qc', [], { cwd: __dirname });
video.on('info', function () {
  console.log(arguments);
});
video.on('data', function (buffer) {
  // console.log(buffer.length);
});
var command = Con(video);
command.on('start', () => {
  // console.log(arguments);
});
command.on('progress', function () {
  // console.log('progress');
});
debugStream(command);
command.save('myvideo.mp3');

function debugStream(stream) {
  const emit = stream.emit;
  stream.emit = function () {
    console.log(arguments[0]);
    emit.apply(stream, arguments);
  };
}
