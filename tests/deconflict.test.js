const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const CHECK_FILES = [
  'index.html',
  'tests.html',
  'src/core/rules.js',
  'src/core/stateMachine.js',
  'src/core/storage.js',
  'src/core/loop.js',
  'src/core/input.js',
  'src/render/background.js',
  'src/render/pipes.js',
  'src/render/bird.js',
  'src/render/hud.js',
  'src/render/ground.js',
  'src/render/effects.js'
];

const mergeMarkers = ['<<<<<<<', '=======', '>>>>>>>'];
const seenGlobals = new Map();

for (const rel of CHECK_FILES) {
  const full = path.join(ROOT, rel);
  const text = fs.readFileSync(full, 'utf8');

  for (const marker of mergeMarkers) {
    assert(!text.includes(marker), `Found unresolved merge marker ${marker} in ${rel}`);
  }

  const regex = /global\.(Dragon[A-Za-z0-9_]+)\s*=\s*api/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const name = m[1];
    if (seenGlobals.has(name)) {
      throw new Error(`Duplicate global namespace assignment: ${name} in ${rel} and ${seenGlobals.get(name)}`);
    }
    seenGlobals.set(name, rel);
  }
}

console.log('Deconflict checks passed.');
