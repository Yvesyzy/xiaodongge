const { createReadStream } = require('node:fs');
const path = require('node:path');

// ponytail: playback queues up to 8 MiB; raise only after a real larger queue and memory checks.
const MAX_QUEUE_BYTES = 8 * 1024 * 1024;
const clean = value => typeof value === 'string' && value.length <= 500 ? value.trim() : '';
// Keep the shared music identity convention without shipping TypeScript to the main process.
const normalized = value => clean(value).normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g, '');

async function enrichWindowsTrack(track, localAppData = process.env.LOCALAPPDATA) {
  if (track?.accessEnabled !== true || track.musicMetadata?.sourcePackage !== 'cloudmusic.exe'
    || !clean(track.title) || !clean(track.artistName)
    || typeof localAppData !== 'string' || !path.isAbsolute(localAppData)) return track;
  try {
    const chunks = [];
    let bytes = 0;
    const file = path.join(localAppData, 'NetEase', 'CloudMusic', 'webdata', 'file', 'playingList');
    for await (const chunk of createReadStream(file, { start: 0, end: MAX_QUEUE_BYTES })) {
      bytes += chunk.length;
      if (bytes > MAX_QUEUE_BYTES) return track;
      chunks.push(chunk);
    }
    const queue = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!Array.isArray(queue?.list)) return track;
    const matches = queue.list.filter(item => item?.resourceType === 'track'
      && normalized(item.track?.name) === normalized(track.title)
      && Array.isArray(item.track?.artists)
      && (item.track.artists.some(artist => normalized(artist?.name) === normalized(track.artistName))
        || normalized(item.track.artists.map(artist => clean(artist?.name)).join(' / ')) === normalized(track.artistName)));
    if (matches.length !== 1) return track;
    const song = matches[0].track;
    const names = song.artists.map(artist => clean(artist?.name));
    const artistName = clean(names.join(' / '));
    const albumName = clean(song.album?.name);
    if (!/^\d+$/.test(clean(song.id)) || names.some(name => !name) || !artistName || !albumName
      || (track.albumName && normalized(track.albumName) !== normalized(albumName))) return track;
    return { ...track, artistName, albumName: track.albumName || albumName };
  } catch {
    // Cache reads are optional. Missing, incomplete or changing files must not hide the live SMTC result.
    return track;
  }
}

module.exports = { enrichWindowsTrack };
