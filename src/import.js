const fs = require('fs');

const command = require('commander');
const config = require('config');
const _ = require('lodash');

const lib = require('./lib');

command
  .option('-p, --playlists', 'export playlists')
  .option('-l, --library', 'export library')
  .option('-f, --file <data_file>', 'folder to store exported data')
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

    const backup = JSON.parse(fs.readFileSync(command.file));
    const spotify = await lib.authenticate();
    const me = await getUser(spotify);

    if (command.library && _.has(backup, 'library')) {
      if (_.has(backup, 'library.albums')) {
        await addAlbums(spotify, backup.library.albums);
      }

      if (_.has(backup, 'library.tracks')) {
        await addTracks(spotify, backup.library.tracks);
      }
    }

    if (command.playlists && _.has(backup, 'playlists')) {
      const removed = await removePlaylists(spotify);

      for (pl of backup.playlists) {
        await addPlaylist(spotify, me, pl);
      }
    }

  } catch (ex) {
    console.log(ex);
  }
}

async function getUser(spotify) {
  console.log('Getting current user');
  const me = await spotify.getMe();

  if (me.statusCode == 200) {
    return me.body;
  }
}

async function addAlbums(spotify, albums) {
  console.log('Importing albums into the Library');
  const batch_size = config.get('backup.batch_size');
  while (albums.length) {
    const batch = albums.splice(0, batch_size).map(a => a.id);
    await spotify.addToMySavedAlbums(batch);
  }
}

async function addTracks(spotify, tracks) {
  console.log('Importing tracks into the Library');
  const batch_size = config.get('backup.batch_size');
  while (tracks.length) {
    const batch = tracks.splice(0, batch_size).map(t => t.id);
    await spotify.addToMySavedTracks(batch);
  }
}

async function removePlaylists(spotify) {
  console.log('Cleanup existing playlists'.green);

  let res = await spotify.getUserPlaylists();

  if (res.statusCode == 200) {
    console.log('Retrieving', res.body.total, 'playlists');
    const playlists = await lib.paginate(async (limit, offset) => {
        return await spotify.getUserPlaylists({ limit, offset });
      }, 50, res.body.total);

    console.log('Got', playlists.length, 'playlists');

    for (p of playlists) {
      console.log('Removing playlist', p.id);
      await spotify.unfollowPlaylist(p.id);
    }
  }
}


async function addPlaylist(spotify, me, playlist) {
  console.log('Importing playlists', playlist.name, 'with', playlist.tracks.length, 'tracks');

  const pl = await spotify.createPlaylist(me.id, playlist.name, {
    public: playlist.public,
    collaborative: playlist.collaborative,
    description: _.has(playlist, 'description') ? _.has(playlist, 'description') : '',
  });

  if (pl.statusCode == 200 || pl.statusCode == 201) {
    console.log('created playlist', pl.body.id, 'for', playlist.name);

    const tracks = playlist.tracks;
    while (tracks.length) {
      const batch = tracks.splice(0, 10).map(t => t.uri );
      await spotify.addTracksToPlaylist(pl.body.id, batch);
    }
  }

  return pl;
}
