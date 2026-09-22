import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { InvalidArgumentError, JsonSeoClient, JsonSeoError } from '../dist/esm/index.js';
import { fakeFetch } from './helpers.js';

function client(fetchImpl, options = {}) {
  return new JsonSeoClient('KEY', { fetch: fetchImpl, ...options });
}

describe('создание клиента', () => {
  it('требует ключ', () => {
    assert.throws(() => new JsonSeoClient('   '), InvalidArgumentError);
  });

  it('принимает настройки одним объектом', async () => {
    const http = fakeFetch().json({ balance: 1, currency: 'RUB' });

    await new JsonSeoClient({ apiKey: 'KEY', fetch: http }).balance();

    assert.equal(http.calls[0].headers.Authorization, 'Bearer KEY');
  });

  it('не принимает незнакомую настройку', () => {
    assert.throws(() => new JsonSeoClient('KEY', { retries: 2 }), InvalidArgumentError);
  });

  it('не принимает ключ с символами вне ASCII', () => {
    // Иначе заголовок не соберётся, и сервис ответит «токен не предоставлен».
    // Второй набор — края строки: там родной trim каждого языка свой, и без
    // общего набора обрезки эти ключи расходились бы по SDK.
    const edges = ['\u00a0KEY', '\u2000KEY', '\u0085KEY', 'KEY\u0000', '\u000cKEY', '\u001cKEY', 'KEY\u000b'];

    for (const key of ['КЛЮЧ', 'dead\tbeef', 'dead\u0001beef', 'ключdeadbeef', ...edges]) {
      assert.throws(() => new JsonSeoClient(key), InvalidArgumentError, `ключ ${JSON.stringify(key)}`);
    }
  });

  it('пробелы по краям ключа обрезаются, а не бракуются', async () => {
    const http = fakeFetch().json({});

    await new JsonSeoClient('  Ab3-_.~xYz09 \n', { fetch: http }).balance();

    assert.equal(http.calls[0].headers.Authorization, 'Bearer Ab3-_.~xYz09');
  });

  it('не принимает нецелое или бессмысленное число попыток', () => {
    // NaN приезжает из Number(process.env.ЧЕГО_НЕТ); без проверки повторы
    // платного запроса не кончались бы никогда.
    for (const attempts of [Number.NaN, 0, -5, 2.5, Number.POSITIVE_INFINITY]) {
      assert.throws(
        () => new JsonSeoClient('KEY', { fetch: fakeFetch(), attempts }),
        InvalidArgumentError,
        `attempts = ${attempts} должно отвергаться`,
      );
    }
  });

  it('пустая настройка из частичного конфига не считается незнакомой', () => {
    const partial = { proxy: undefined };

    assert.doesNotThrow(() => new JsonSeoClient('KEY', { fetch: fakeFetch(), ...partial }));
  });

  it('не принимает незнакомый способ авторизации', () => {
    assert.throws(() => client(fakeFetch(), { auth: 'cookie' }), InvalidArgumentError);
  });
});

describe('сборка запроса', () => {
  it('кладёт ключ в заголовок Authorization по умолчанию', async () => {
    const http = fakeFetch().json({ balance: 1, currency: 'RUB' });

    await client(http).balance();

    assert.equal(http.calls[0].headers.Authorization, 'Bearer KEY');
    assert.equal(http.calls[0].params.get('key'), null);
  });

  it('кладёт ключ в параметр, когда попросили', async () => {
    const http = fakeFetch().json({ balance: 1, currency: 'RUB' });

    await client(http, { auth: 'query' }).balance();

    assert.equal(http.calls[0].headers.Authorization, undefined);
    assert.equal(http.calls[0].params.get('key'), 'KEY');
  });

  it('отправляет POST по адресу метода', async () => {
    const http = fakeFetch().json({ results: [] });

    await client(http).yandex('купить ноутбук');

    assert.equal(http.calls[0].method, 'POST');
    assert.equal(http.calls[0].url, 'https://jsonseo.ru/api/yandex');
  });

  it('убирает лишний слеш из base_url', async () => {
    const http = fakeFetch().json({ results: [] });

    await client(http, { baseUrl: 'http://localhost:8080/api/' }).yandex('тест');

    assert.equal(http.calls[0].url, 'http://localhost:8080/api/yandex');
  });

  it('строку принимает как основной параметр метода', async () => {
    const http = fakeFetch().json({ results: [] }).json({ results: [] });
    const api = client(http);

    await api.yandex('купить ноутбук');
    await api.google('купить ноутбук');

    assert.equal(http.calls[0].params.get('text'), 'купить ноутбук');
    assert.equal(http.calls[1].params.get('q'), 'купить ноутбук');
  });

  it('список фраз склеивает переводом строки', async () => {
    const http = fakeFetch().json({ results: [] });

    await client(http).direct(['ремонт айфона', 'ремонт телефона']);

    assert.equal(http.calls[0].params.get('phrases'), 'ремонт айфона\nремонт телефона');
  });

  it('остальные списки склеивает запятой', async () => {
    const http = fakeFetch().json({ results: [] });

    await client(http).wordstat({ text: 'ремонт', region: [213, 2], device: ['desktop', 'phone'] });

    assert.equal(http.calls[0].params.get('region'), '213,2');
    assert.equal(http.calls[0].params.get('device'), 'desktop,phone');
  });

  it('флаги превращает в единицу и ноль', async () => {
    const http = fakeFetch().json({ results: [] });

    await client(http).yandex({ text: 'тест', ai: true, noreask: false });

    assert.equal(http.calls[0].params.get('ai'), '1');
    assert.equal(http.calls[0].params.get('noreask'), '0');
  });

  it('пустые значения не отправляет', async () => {
    const http = fakeFetch().json({ results: [] });

    await client(http).yandex({ text: 'тест', break_domain: null, zone: undefined });

    assert.equal(http.calls[0].params.get('break_domain'), null);
    assert.equal(http.calls[0].params.get('zone'), null);
  });

  it('не пропускает нечисловые числа', async () => {
    await assert.rejects(() => client(fakeFetch()).call('geoip', { page: Number.NaN }), InvalidArgumentError);
  });

  it('balance не добавляет своих параметров', async () => {
    const http = fakeFetch().json({ balance: 0, currency: 'RUB' });

    await client(http).balance();

    assert.equal(http.calls[0].body, '');
  });
});

describe('разбор ответа', () => {
  it('возвращает разобранный JSON', async () => {
    const http = fakeFetch().json({ balance: 123.45, currency: 'RUB' });

    const balance = await client(http).balance();

    assert.deepEqual(balance, { balance: 123.45, currency: 'RUB' });
  });

  it('неразбираемое тело превращает в ошибку', async () => {
    const http = fakeFetch().raw('<html>прокси съел ответ</html>');

    await assert.rejects(() => client(http).balance(), JsonSeoError);
  });
});

describe('покрытие методов', () => {
  it('каждый метод стучится в свой путь', async () => {
    const methods = {
      yandex: 'yandex',
      yandexSuggest: 'yandex/suggest',
      yandexRegions: 'yandex/regions',
      yandexImages: 'yandex/images',
      yandexVideo: 'yandex/video',
      google: 'google',
      googleSuggest: 'google/suggest',
      googleRegions: 'google/regions',
      googleImages: 'google/images',
      googleVideo: 'google/video',
      bing: 'bing',
      bingSuggest: 'bing/suggest',
      bingImages: 'bing/images',
      bingVideo: 'bing/video',
      wordstat: 'wordstat',
      wordstatFrequency: 'wordstat/frequency',
      wordstatGraph: 'wordstat/graph',
      wordstatMap: 'wordstat/map',
      direct: 'direct',
      geoip: 'geoip',
    };

    const http = fakeFetch();
    const api = client(http);
    let index = 0;

    for (const [method, path] of Object.entries(methods)) {
      http.raw('{}');
      await api[method]('тест');

      assert.equal(http.calls[index].url, `https://jsonseo.ru/api/${path}`, `метод ${method} ушёл не по своему адресу`);
      index++;
    }

    http.json({ balance: 0, currency: 'RUB' });
    await api.balance();

    assert.equal(http.calls[index].url, 'https://jsonseo.ru/api/balance');
    assert.equal(http.calls.length, Object.keys(methods).length + 1);
  });

  it('call доходит до произвольного пути', async () => {
    const http = fakeFetch().json({ ok: true });

    await client(http).call('новый/метод', { a: 1 });

    assert.equal(http.calls[0].url, 'https://jsonseo.ru/api/новый/метод');
  });
});
