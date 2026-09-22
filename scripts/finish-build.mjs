import { writeFileSync } from 'node:fs';

/**
 * В корне пакета "type": "module", поэтому Node считает модулями и файлы
 * в dist/cjs. Маркер рядом со сборкой переключает их обратно.
 */
writeFileSync('dist/esm/package.json', JSON.stringify({ type: 'module' }, null, 2) + '\n');
writeFileSync('dist/cjs/package.json', JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
