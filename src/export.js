const fs = require('fs');

const command = require('commander');
const config = require('config');
const _ = require('lodash');

const lib = require('./lib');

command
  .option('-p, --playlists', 'export playlists')
  .option('-l, --library', 'export library')
  .option('-f, --folder [folder_name]', 'folder to store exported data', './data')
  .description('export data from your Spotify account')
  .on('-h, --help', function () {
    console.log('  Examples:');
    console.log('   $ node export -p -l');
  })
  .parse(process.argv);

backup();

async function backup() {
  try {
    const spotify = await lib.authenticate();
    const playlists = await getPlaylists(spotify);
    console.log('Got', playlists.length, 'playlists');

    const backup = await getLibrary(spotify);
    backup.playlists = [];

    for (p of playlists) {
      let tracks = await getTracks(spotify, p);
      p.tracks.items = tracks;
      backup.playlists.push(p);
    }

    const backupFilename = lib.filename();
    console.log('Storing backup to', backupFilename);
    fs.writeFileSync(backupFilename, JSON.stringify(backup, null, '  '));
  } catch (ex) {
    console.log(ex);
  }
}


async function getPlaylists(spotify) {
  console.log('Getting user\'s playlists'.green);

  let res = await spotify.getUserPlaylists();

  if (res.statusCode == 200) {
    console.log('Retrieving', res.body.total, 'playlists');
    const playlists = await lib.paginate(async (limit, offset) => {
        return await spotify.getUserPlaylists({ limit, offset });
      }, 50, res.body.total);

    return playlists;
  }
}


async function getTracks(spotify, playlist) {
  console.log('Getting playlist', playlist.id, 'with', playlist.tracks.total, 'tracks');

  const tracks = await lib.paginate(async(limit, offset) => {
      return await spotify.getPlaylistTracks(playlist.id, { limit, offset });
    }, 100, playlist.tracks.total);

  return tracks;
}

async function getLibrary(spotify) {
  console.log('Getting user Library'.green);

  let albums = await spotify.getMySavedAlbums();
  let tracks = await spotify.getMySavedTracks();

  if (albums.statusCode == 200 && tracks.statusCode == 200) {
    const [a, t] = await Promise.all([
      lib.paginate(async(limit, offset) => {
        return await spotify.getMySavedAlbums({ limit, offset });
      }, 50, albums.body.total),
      lib.paginate(async(limit, offset) => {
        return await spotify.getMySavedTracks({ limit, offset });
      }, 50, tracks.body.total),
    ]);

    return { albums: a, tracks: t };
  }
}
