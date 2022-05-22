/*
Copied from https://github.com/openstyles/stylus/blob/master/tools/build-vendor.js ; "files" has been modified and buildThemeList has been removed

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

const fetch = require('node-fetch');
const fs = require('fs');
const fse = require('fs-extra');
const glob = require('glob').sync;
const path = require('path');

const KEEP_DIRECTORIES = null;

const files = {
  "webextension-polyfill": [
    "dist/browser-polyfill.min.js"
  ]
};

main().catch(console.error);

async function main() {
  fse.emptyDirSync('vendor');
  await Promise.all(Object.keys(files).map(async pkg => {
    console.log(`Building ${pkg}...`);
    const pkgName = getFileName(pkg);
    const flatPkg = pkg === pkgName || files[pkgName]
      ? pkg.replace(/\//g, '-')
      : pkgName;
    const res = await buildFiles(pkg, flatPkg, files[pkg]);
    buildLicense(pkg, flatPkg);
    buildReadme(pkg, flatPkg, res);
  }));
}

async function buildFiles(pkg, flatPkg, patterns) {
  const keepDirs = patterns.includes(KEEP_DIRECTORIES);
  let fetched = '';
  let copied = '';
  for (let pattern of patterns) {
    if (pattern === KEEP_DIRECTORIES) continue;
    pattern = pattern.replace('{VERSION}', require(`${pkg}/package.json`).version);
    const [src, dest = !keepDirs && getFileName(src)] = pattern.split(/\s*->\s*/);
    if (/^https?:/.test(src)) {
      fse.outputFileSync(`vendor/${flatPkg}/${dest}`, await (await fetch(src)).text());
      fetched += `* ${dest}: ${src}\n`;
    } else {
      const files = glob(`node_modules/${pkg}/${src}`);
      if (!files.length) {
        throw new Error(`Pattern ${src} matches no files`);
      }
      for (const file of files) {
        fse.copySync(file, dest
          ? `vendor/${flatPkg}/${dest}`
          : `vendor/${path.relative('node_modules', file).replace(pkg + '/', flatPkg + '/')}`);
        copied += `* ${reportFile(pkg, file, dest)}\n`;
      }
    }
  }
  return {fetched, copied};
}

function buildLicense(pkg, flatPkg) {
  const LICENSE = `vendor/${flatPkg}/LICENSE`;
  if (!fs.existsSync(LICENSE)) {
    const [src] = glob(`node_modules/${pkg}/LICEN[SC]E*`);
    if (!src) throw new Error(`Cannot find license file for ${pkg}`);
    fse.copySync(src, LICENSE);
  }
}

function buildReadme(pkg, flatPkg, {fetched, copied}) {
  const {name, version} = require(`${pkg}/package.json`);
  fse.outputFileSync(`vendor/${flatPkg}/README.md`, [
    `## ${name} v${version}`,
    fetched && `Files downloaded from URL:\n${fetched}`,
    copied && `Files copied from NPM (node_modules):\n${copied}`,
  ].filter(Boolean).join('\n\n'));
}

function getFileName(path) {
  return path.split('/').pop();
}

function reportFile(pkg, file, dest) {
  file = path.relative(`node_modules/${pkg}`, file).replace(/\\/g, '/');
  if (!dest || dest === file) {
    return file;
  }
  if (file.includes('/') && getFileName(dest) === getFileName(file)) {
    file = file.replace(/[^/]+$/, '*');
  }
  return `${dest}: ${file}`;
}
