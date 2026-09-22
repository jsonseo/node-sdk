import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import * as esm from '../dist/esm/index.js';

const require = createRequire(import.meta.url);

/**
 * Остальные тесты идут только по ESM-сборке, поэтому половина упаковки
 * оставалась бы непроверенной.
 */
describe('упаковка', () => {
  it('CommonJS-сборка грузится через require', () => {
    const cjs = require('../dist/cjs/index.js');

    assert.equal(typeof cjs.JsonSeoClient, 'function');
    assert.equal(typeof cjs.ValidationError, 'function');
  });

  it('обе сборки отдают один и тот же набор экспортов', () => {
    const cjs = require('../dist/cjs/index.js');

    assert.deepEqual(Object.keys(cjs).sort(), Object.keys(esm).sort());
  });

  it('каждое условие exports несёт свои декларации типов', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const entry = manifest.exports['.'];

    assert.equal(entry.require.types, './dist/cjs/index.d.ts');
    assert.equal(entry.import.types, './dist/esm/index.d.ts');

    for (const build of ['cjs', 'esm']) {
      const declarations = readFileSync(new URL(`../dist/${build}/index.d.ts`, import.meta.url), 'utf8');

      assert.ok(declarations.includes('JsonSeoClient'), `в сборке ${build} нет деклараций`);
    }
  });

  it('обе сборки помечены своим типом модулей', () => {
    const esmMarker = JSON.parse(readFileSync(new URL('../dist/esm/package.json', import.meta.url), 'utf8'));
    const cjsMarker = JSON.parse(readFileSync(new URL('../dist/cjs/package.json', import.meta.url), 'utf8'));

    assert.equal(esmMarker.type, 'module');
    assert.equal(cjsMarker.type, 'commonjs');
  });

  it('в собранной библиотеке нет зависимостей от node:', () => {
    for (const build of ['esm', 'cjs']) {
      const dir = new URL(`../dist/${build}/`, import.meta.url);

      for (const file of readdirSync(dir).filter((name) => name.endsWith('.js'))) {
        const source = readFileSync(new URL(file, dir), 'utf8');

        assert.ok(!source.includes('node:'), `${build}/${file} тянет node: и не пойдёт в браузере или воркере`);
      }
    }
  });

  it('пакет не тянет зависимостей', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

    assert.equal(manifest.dependencies, undefined);
  });
});
