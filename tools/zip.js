/*
Copied from https://github.com/openstyles/stylus/blob/master/tools/zip.js ; "fileName" and "ignore" have been modified

License:

Inherited code from the original Stylish:
Copyright © 2005-2014 Jason Barnabe
Current Stylus:
Copyright © 2017-2019 Stylus Team
GNU GPLv3
This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
You should have received a copy of the GNU General Public License along with this program. If not, see https://www.gnu.org/licenses/.
*/

'use strict';

const fs = require('fs');
const archiver = require('archiver');

function createZip() {
  const fileName = 'gender-neutral-guide.zip';
  const ignore = [
    '.*', // dot files/folders (glob, not regexp)
    'node_modules/**',
    'tools/**',
    'package.json',
    'package-lock.json',
    'yarn.lock',
    '*.zip',
    '*.map',

    'jsconfig.json',
    '*.gitignore/**',
    'wordlist/**'
  ];

  const file = fs.createWriteStream(fileName);
  const archive = archiver('zip');
  return new Promise((resolve, reject) => {
    archive.on('finish', () => {
      resolve();
    });
    archive.on('warning', err => {
      if (err.code === 'ENOENT') {
        console.log('\x1b[33m%s\x1b[0m', 'Warning', err.message);
      } else {
        reject();
        throw err;
      }
    });
    archive.on('error', err => {
      reject();
      throw err;
    });

    archive.pipe(file);
    archive.glob('**', {ignore});
    archive.finalize();
  });
}

(async () => {
  try {
    await createZip();
    console.log('\x1b[32m%s\x1b[0m', 'Zip complete');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
