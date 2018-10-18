const colors = require('colors');
const config = require('config');
require('dotenv').config();
const _ = require('lodash');
const moment = require('moment');
const randomstring = require('randomstring');
const SpotifyApi = require('spotify-web-api-node');


module.exports = {
  async authenticate() {
    console.log('Authenticate'.green);
    var spotify = new SpotifyApi();
    spotify.setAccessToken(process.env.ACCESS_TOKEN);
    return spotify;
  },

  filename(folder) {
    return folder + '/' + randomstring.generate(16) + '.json';
  },

  // f is function taking 2 params: limit and offset
  async paginate(f, pageSize, total) {
    let offset = 0;

    // calculate how many times we have to paginate
    let pages = [];
    while (offset < total) {
      pages.push(offset);
      offset += pageSize;
    }

    // paginate thru the results
    let all = await Promise.all(pages.map(async (offset) => {
      let res = await f(pageSize, offset);
      if (res.statusCode == 200) {
        return res.body.items;
      }
    }));

    return _.flatten(all);
  },


}
