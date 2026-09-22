import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { encodeParams, InvalidArgumentError, JsonSeoClient, ParseError } from '../dist/esm/index.js';
import { fakeFetch } from './helpers.js';

/**
 * encodeParams решает, в каком виде параметры уедут в сервис: ошибка здесь —
 * искажённый запрос за деньги клиента.
 */
describe('кодирование параметров', () => {
  it('склеивает списки запятой, а фразы — переводом строки', () => {
    assert.equal(encodeParams({ region: [213, 2] }).get('region'), '213,2');
    assert.equal(encodeParams({ phrases: ['один', 'два'] }).get('phrases'), 'один\nдва');
  });

  it('флаги превращает в единицу и ноль', () => {
    assert.equal(encodeParams({ ai: true, ads: false }).get('ai'), '1');
    assert.equal(encodeParams({ ai: true, ads: false }).get('ads'), '0');
  });

  it('пустые значения не отправляет', () => {
    const query = encodeParams({ a: null, b: undefined, c: [], d: 'есть' });

    assert.equal(query.toString(), 'd=%D0%B5%D1%81%D1%82%D1%8C');
  });

  it('пустая строка отличается от отсутствующего значения', () => {
    assert.equal(encodeParams({ q: '' }).has('q'), true);
  });

  it('не пропускает нечисловые числа', () => {
    assert.throws(() => encodeParams({ page: Number.NaN }), InvalidArgumentError);
    assert.throws(() => encodeParams({ page: Number.POSITIVE_INFINITY }), InvalidArgumentError);
  });

  it('в ошибке называет место негодного значения внутри списка', () => {
    try {
      encodeParams({ region: [213, {}] });
      assert.fail('ожидался отказ');
    } catch (error) {
      assert.ok(error instanceof InvalidArgumentError);
      assert.ok(error.message.includes('region[1]'), `сообщение не называет место: ${error.message}`);
    }
  });
});

describe('сырой ответ', () => {
  it('callRaw не разбирает тело и просит не-JSON', async () => {
    const body = '<?xml version="1.0"?><yandexsearch></yandexsearch>';
    const http = fakeFetch().raw(body);

    const result = await new JsonSeoClient('KEY', { fetch: http }).callRaw('yandex/xml', { query: 'тест' });

    assert.equal(result, body);
    assert.equal(http.calls[0].headers.Accept, 'application/xml, text/xml');
    assert.equal(http.calls[0].params.get('query'), 'тест');
  });

  it('неразобранный успешный ответ сохраняет тело в ошибке', async () => {
    const http = fakeFetch().raw('<html>прокси съел ответ</html>');

    await assert.rejects(() => new JsonSeoClient('KEY', { fetch: http }).balance(), (error) => {
      assert.ok(error instanceof ParseError);
      assert.equal(error.body, '<html>прокси съел ответ</html>');

      return true;
    });
  });
});

describe('заголовки запроса', () => {
  it('подпись клиента доезжает до User-Agent', async () => {
    const http = fakeFetch().json({}).json({});

    await new JsonSeoClient('KEY', { fetch: http }).balance();
    assert.ok(http.calls[0].headers['User-Agent'].startsWith('jsonseo-node/'));

    await new JsonSeoClient('KEY', { fetch: http, userAgent: 'мой-проект/1.0' }).balance();
    assert.equal(http.calls[1].headers['User-Agent'], 'мой-проект/1.0');
  });

  it('брак аргументов приезжает отказом промиса, а не синхронным броском', async () => {
    const api = new JsonSeoClient('KEY', { fetch: fakeFetch() });

    let threwSynchronously = false;
    let promise;

    try {
      promise = api.yandex(123);
    } catch {
      threwSynchronously = true;
    }

    assert.equal(threwSynchronously, false, 'синхронный throw пролетает мимо .catch()');
    await assert.rejects(() => promise, InvalidArgumentError);
  });
});
