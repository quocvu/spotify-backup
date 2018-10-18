const fs = require('fs');

const command = require('commander');
const _ = require('lodash');

const lib = require('./lib');

command
  .option('-p, --playlists', 'export playlists')
  .option('-l, --library', 'export library')
  .option('-f, --file <data_file>', 'folder to store exported data', './data')
  .description('import data into your Spotify account')
  .on('-h, --help', function () {
    console.log('  Examples:');
    console.log('   $ node import -p -l -f data.json');
  })
  .parse(process.argv);


restore();

async function restore() {
  try {
    console.log('restore backup from', command.file);

    const backup = JSON.parse(fs.readFileSync(commander.file));
    const spotify = await lib.authenticate();

    if (command.playlists && _.has(backup, 'playlists')) {
      for (pl of backup.playlists) {
        await addPlaylist(spotify, pl);
      }
    }

  } catch (ex) {
    console.log(ex);
  }
}

async function addPlaylist(spotify, playlist) {
  const pl = await spotify.createPlaylist(playlist.owner.id, playlist.name, {
    public: playlist.public,
    collaborative: playlist.collaborative,
    description: _.has(playlist, 'description') ? _.has(playlist, 'description') : '',
  });

  if (pl.statusCode == 200) {
    const tracks = playlist.tracks.items;
    while (tracks.length) {
      const batch = a.splice(0, 10);
      await addTracks(spotify, pl.id, batch);
    }
  }

  return pl;
}

async function addTracks(spotify, playlist, tracks) {
  const tracksIds = [];

  tracks.forEach(t => {
    tracksIds.push(t.track.uri);
  })

  const t = await spotify.addTracksToPlaylist(playlist, tracksIds);
  return t;
}
