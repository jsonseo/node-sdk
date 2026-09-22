import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Ставит собранный пакет в чистый проект и типизует его из .cts и .mts.
 *
 * Своей сборки для этого мало: у пакета два условия exports, и у каждого
 * свои декларации. Один раз они уже разъехались — CommonJS-потребитель
 * получал ошибку, которой не видел ни один тест.
 *
 * Запуск: node scripts/check-consumer.mjs [версия TypeScript] [moduleResolution]
 */

const version = process.argv[2] ?? '7';
const resolution = process.argv[3] ?? 'node16';
// pathname на Windows даёт /C:/..., который не откроется.
const root = fileURLToPath(new URL('..', import.meta.url));
const project = mkdtempSync(join(tmpdir(), 'jsonseo-consumer-'));

const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

try {
  console.log(`Проверяю потребителя: TypeScript ${version}, moduleResolution ${resolution}`);

  const packed = execFileSync('npm', ['pack', '--silent', '--pack-destination', project], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
    .trim()
    .split('\n')
    .pop();

  writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'consumer', private: true }, null, 2));

  run('npm', ['install', '--silent', '--no-audit', '--no-fund', join(project, packed), `typescript@${version}`], project);

  // node10 умеет только module commonjs; у остальных — своя пара.
  const module = resolution === 'node16' ? 'node16' : resolution === 'node10' ? 'commonjs' : 'esnext';

  writeFileSync(
    join(project, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          module,
          moduleResolution: resolution,
          strict: true,
          noEmit: true,
          target: 'ES2022',
          lib: ['ES2022', 'DOM'],
          types: [],
          skipLibCheck: false,
        },
        files: resolution === 'node16' ? ['a.cts', 'b.mts'] : ['c.ts'],
      },
      null,
      2,
    ),
  );

  // При node16 проверяются оба входа сразу: require и import резолвятся
  // по разным условиям exports и разным декларациям.
  writeFileSync(
    join(project, 'a.cts'),
    [
      "import { JsonSeoClient, ValidationError, type SearchResponse } from 'jsonseo';",
      "const client = new JsonSeoClient('KEY', { attempts: 3 });",
      "export const serp: Promise<SearchResponse> = client.yandex({ text: 'тест', region: 213 });",
      'export const failure = ValidationError;',
      '',
    ].join('\n'),
  );

  writeFileSync(
    join(project, 'b.mts'),
    [
      "import { JsonSeoClient, type WordstatResponse } from 'jsonseo';",
      "const client = new JsonSeoClient('KEY');",
      "export const words: Promise<WordstatResponse> = client.wordstat({ text: 'ремонт', region: [213, 2] });",
      '',
    ].join('\n'),
  );

  writeFileSync(
    join(project, 'c.ts'),
    [
      "import { JsonSeoClient, type GeoipResponse } from 'jsonseo';",
      "const client = new JsonSeoClient('KEY');",
      "export const geo: Promise<GeoipResponse> = client.geoip('77.88.55.242');",
      '',
    ].join('\n'),
  );

  run('npx', ['tsc'], project);

  // Рантайм тоже: декларации могут сойтись, а файл не найтись.
  run('node', ['-e', "const m = require('jsonseo'); if (typeof m.JsonSeoClient !== 'function') throw new Error('require сломан')"], project);
  run('node', ['--input-type=module', '-e', "import { JsonSeoClient } from 'jsonseo'; if (typeof JsonSeoClient !== 'function') throw new Error('import сломан')"], project);

  console.log('Потребитель собирается и грузится: типы и рантайм на месте.');
} finally {
  rmSync(project, { recursive: true, force: true });
}
