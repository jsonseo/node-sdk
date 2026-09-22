import { writeFileSync } from 'node:fs';

/**
 * В корне пакета стоит "type": "module", поэтому Node считает модулями и
 * файлы в dist/cjs. Маркер рядом со сборкой переключает их обратно — без
 * него require() падает на первом же файле.
 */
writeFileSync('dist/esm/package.json', JSON.stringify({ type: 'module' }, null, 2) + '\n');
writeFileSync('dist/cjs/package.json', JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
