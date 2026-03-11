const path = require('node:path');
const { MakerDMG } = require('@electron-forge/maker-dmg');
const { MakerZIP } = require('@electron-forge/maker-zip');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.join(__dirname, 'assets', 'icon'),
  },
  makers: [
    new MakerDMG({}, ['darwin']),
    new MakerZIP({}, ['darwin', 'linux', 'win32']),
  ],
};
