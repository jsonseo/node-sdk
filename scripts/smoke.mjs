import assert from 'node:assert/strict';

import { JsonSeoClient, UnauthorizedError, ValidationError } from '../dist/esm/index.js';

/**
 * Проверка собранного пакета в конкретной среде: `node scripts/smoke.mjs`,
 * `bun scripts/smoke.mjs`, `deno run scripts/smoke.mjs`. Сеть не нужна.
 */

const calls = [];
const responses = [
  new Response(JSON.stringify({ query: 'купить ноутбук', results: [{ url: 'https://example.com', domain: 'example.com' }] })),
  new Response(JSON.stringify({ message: 'Введите запрос', errors: { text: ['Введите запрос'] } }), { status: 422 }),
  new Response(JSON.stringify({ message: 'Недействительный токен авторизации.' }), { status: 403 }),
  new Response(JSON.stringify({ balance: 123.45, currency: 'RUB' })),
];

const client = new JsonSeoClient('КЛЮЧ-ДЛЯ-ПРОВЕРКИ', {
  retries: 0,
  fetch: async (url, init) => {
    calls.push({ url, params: new URLSearchParams(init.body) });

    return responses.shift();
  },
});

const serp = await client.yandex({ text: 'купить ноутбук', region: 213, ai: true });

assert.equal(calls[0].url, 'https://jsonseo.ru/api/yandex');
assert.equal(calls[0].params.get('text'), 'купить ноутбук');
assert.equal(calls[0].params.get('ai'), '1');
assert.equal(serp.results[0].domain, 'example.com');

await assert.rejects(() => client.yandex(''), (error) => {
  assert.ok(error instanceof ValidationError);
  assert.deepEqual(error.fields, ['text']);

  return true;
});

await assert.rejects(() => client.wordstat('ремонт'), UnauthorizedError);

assert.equal((await client.balance()).currency, 'RUB');

console.log('JSON SEO SDK: проверка пройдена,', calls.length, 'запроса собрано и разобрано');
