const fs = require('fs');

const command = require('commander');
const config = require('config');
const _ = require('lodash');

const lib = require('./lib');

command
  .option('-p, --playlists', 'export playlists')
  .option('-l, --library', 'export library')
  .option('-f, --folder [folder_name]', 'folder to store exported data')
  .description('export data from your Spotify account')
  .on('-h, --help', function () {
    console.log('  Examples:');
    console.log('   $ node export -p -l');
  })
  .parse(process.argv);

const folder = command.folder || config.get('backup.folder') || './backup';

backup();

async function backup() {
  try {
    const spotify = await lib.authenticate();
    /*
    const [ pl, library ] = await Promise.all([
      await getPlaylists(spotify),
      await getLibrary(spotify)
    ]);
    */

    const pl = await getPlaylists(spotify);
    const library = await getLibrary(spotify);

    const playlists = [];
    for (p of pl) {
      let tracks = await getTracks(spotify, p);
      p.tracks = tracks;
      playlists.push(p);
    }

    const backupFilename = lib.filename(folder);
    console.log('Storing backup to', backupFilename);
    fs.writeFileSync(backupFilename, JSON.stringify({ playlists, library }, null, '  '));
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

    console.log('Got', playlists.length, 'playlists');

    return playlists.map(p => {
      let playlist = _.pick(p, [ 'id', 'name', 'collaborative', 'description', 'uri' ]);
      playlist.tracks = p.tracks.total;
      return playlist;
    });
  }
}

async function getTracks(spotify, playlist) {
  console.log('Getting playlist', playlist.id, 'with', playlist.tracks, 'tracks');

  const tracks = await lib.paginate(async(limit, offset) => {
      return await spotify.getPlaylistTracks(playlist.id, { limit, offset });
    }, 100, playlist.tracks);

  console.log('Got', tracks.length, 'tracks for playlist', playlist.id);

  return tracks.map(t => { return { id: t.track.id, uri: t.track.uri, name: t.track.name }});
}

async function getLibrary(spotify) {
  console.log('Getting user\'s Library'.green);

  let albums = await spotify.getMySavedAlbums();
  let tracks = await spotify.getMySavedTracks();

  if (albums.statusCode == 200 && tracks.statusCode == 200) {
    let a = await lib.paginate(async(limit, offset) => {
      return await spotify.getMySavedAlbums({ limit, offset });
    }, 50, albums.body.total);

    let t = await lib.paginate(async(limit, offset) => {
      return await spotify.getMySavedTracks({ limit, offset });
    }, 50, tracks.body.total);

    t = t.map(i => { return { id: i.track.id, uri: i.track.uri, name: i.track.name }});
    a = a.map(i => { return { id: i.album.id, name: i.album.name, uri: i.album.uri }});

    console.log('Got', a.length, 'albums and', t.length, 'tracks from the Library');
    return { albums: a, tracks: t };
  }
}
