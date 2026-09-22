import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AbortError,
  JsonSeoClient,
  NetworkError,
  PaymentRequiredError,
  RateLimitError,
  ServiceUnavailableError,
  TimeoutError,
  UnauthorizedError,
  ValidationError,
} from '../dist/esm/index.js';
import { fakeFetch } from './helpers.js';

/** Паузы обнулены: проверяется решение о повторе, а не длительность сна. */
function client(fetchImpl, options = {}) {
  return new JsonSeoClient('KEY', {
    fetch: fetchImpl,
    retryDelayMs: 0,
    maxRetryDelayMs: 0,
    ...options,
  });
}

describe('повторы', () => {
  it('временный отказ повторяется', async () => {
    const http = fakeFetch().json({ message: 'Сервис временно недоступен.' }, 503).json({ results: ['ok'] });

    const serp = await client(http).yandex('тест');

    assert.deepEqual(serp.results, ['ok']);
    assert.equal(http.calls.length, 2);
  });

  /**
   * Без Retry-After пауза берётся из собственного бэкоффа — случай с
   * названным сроком проверяется отдельно.
   */
  it('лимит частоты повторяется', async () => {
    const http = fakeFetch().json({ message: 'Too Many Attempts.' }, 429).json({ results: [] });

    await client(http).yandex('тест');

    assert.equal(http.calls.length, 2);
  });

  it('оборванное соединение повторяется', async () => {
    const http = fakeFetch().fail('соединение оборвано').json({ results: [] });

    await client(http).yandex('тест');

    assert.equal(http.calls.length, 2);
  });

  it('повторы кончаются на заданном числе', async () => {
    const http = fakeFetch()
      .json({ message: 'Too Many Attempts.' }, 429)
      .json({ message: 'Too Many Attempts.' }, 429)
      .json({ message: 'Too Many Attempts.' }, 429);

    await assert.rejects(() => client(http, { retries: 2 }).yandex('тест'), RateLimitError);
    assert.equal(http.calls.length, 3);
  });

  it('ошибка валидации не повторяется', async () => {
    const http = fakeFetch().json({ message: 'Введите запрос' }, 422);

    await assert.rejects(() => client(http).yandex(''), ValidationError);
    assert.equal(http.calls.length, 1);
  });

  it('нехватка средств не повторяется', async () => {
    const http = fakeFetch().json({ message: 'Недостаточно средств.' }, 402);

    await assert.rejects(() => client(http).yandex('тест'), PaymentRequiredError);
    assert.equal(http.calls.length, 1);
  });

  it('повторы можно выключить', async () => {
    const http = fakeFetch().fail('сеть недоступна');

    await assert.rejects(() => client(http, { retries: 0 }).yandex('тест'), NetworkError);
    assert.equal(http.calls.length, 1);
  });

  it('ошибки сервера повторяются', async () => {
    for (const status of [500, 502, 504]) {
      const http = fakeFetch().json({ message: 'Ошибка' }, status).json({ results: [] });

      await client(http).yandex('тест');

      assert.equal(http.calls.length, 2, `статус ${status} должен повторяться`);
    }
  });

  it('плохой ключ не повторяется', async () => {
    const http = fakeFetch().json({ message: 'Недействительный токен.' }, 401);

    await assert.rejects(() => client(http).yandex('тест'), UnauthorizedError);
    assert.equal(http.calls.length, 1);
  });

  it('пауза берётся из Retry-After в секундах, а не в миллисекундах', async () => {
    const http = fakeFetch()
      .json({ message: 'Too Many Attempts.' }, 429, { 'retry-after': '1' })
      .json({ results: [] });

    const started = Date.now();
    await client(http, { maxRetryDelayMs: 30_000 }).yandex('тест');

    assert.equal(http.calls.length, 2);
    assert.ok(Date.now() - started >= 1000, 'пауза должна быть не меньше секунды');
  });

  it('срок дольше собственного потолка прекращает повторы', async () => {
    const http = fakeFetch()
      .json({ message: 'Too Many Attempts.' }, 429, { 'retry-after': '600' })
      .json({ results: [] });

    await assert.rejects(() => client(http, { maxRetryDelayMs: 30_000 }).yandex('тест'), (error) => {
      assert.ok(error instanceof RateLimitError);
      assert.equal(error.retryAfter, 600);

      return true;
    });
    assert.equal(http.calls.length, 1);
  });

  it('Retry-After принимается и HTTP-датой', async () => {
    const when = new Date(Date.now() + 600_000).toUTCString();
    const http = fakeFetch().json({ message: 'Too Many Attempts.' }, 429, { 'retry-after': when });

    await assert.rejects(() => client(http, { maxRetryDelayMs: 30_000 }).yandex('тест'), (error) => {
      assert.ok(error.retryAfter > 500);

      return true;
    });
  });

  it('повторный запрос несёт то же тело', async () => {
    const http = fakeFetch().json({ message: 'Недоступен' }, 503).json({ results: [] });

    await client(http).yandex({ text: 'купить ноутбук', pages: 3 });

    assert.equal(http.calls[0].body, http.calls[1].body);
  });

  it('503 тоже несёт названный сервисом срок', async () => {
    const http = fakeFetch().json({ message: 'Недоступен' }, 503, { 'retry-after': '120' });

    await assert.rejects(() => client(http, { maxRetryDelayMs: 30_000 }).yandex('тест'), (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.retryAfter, 120);

      return true;
    });
  });

  it('таймаут не повторяется: сервис уже считает оплаченный запрос', async () => {
    const http = fakeFetch().hang().json({ results: [] });

    await assert.rejects(() => client(http, { timeoutMs: 20 }).yandex('тест'), TimeoutError);
    assert.equal(http.calls.length, 1);
  });
});

describe('отмена запроса', () => {
  it('запрос с уже отменённым сигналом не уходит в сеть', async () => {
    const http = fakeFetch();
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(() => client(http).yandex('тест', { signal: controller.signal }), AbortError);
    assert.equal(http.calls.length, 0);
  });

  it('отмена на лету превращается в AbortError', async () => {
    const http = fakeFetch().hang();
    const controller = new AbortController();

    const request = client(http).yandex('тест', { signal: controller.signal });
    setTimeout(() => controller.abort(), 10);

    await assert.rejects(() => request, AbortError);
  });

  it('таймаут на отдельный запрос сильнее общего', async () => {
    const http = fakeFetch().hang();

    await assert.rejects(
      () => client(http, { timeoutMs: 60_000, retries: 0 }).yandex('тест', { timeoutMs: 20 }),
      TimeoutError,
    );
  });

  /**
   * Пауза между попытками обязана прерываться сигналом: иначе отмена
   * замечалась бы только на следующем витке, то есть через всю паузу
   * целиком — до 30 секунд при значениях по умолчанию.
   */
  it('отмена во время паузы между повторами срабатывает сразу', async () => {
    const http = fakeFetch()
      .json({ message: 'Too Many Attempts.' }, 429, { 'retry-after': '5' })
      .json({ results: [] });

    const controller = new AbortController();
    const api = new JsonSeoClient('KEY', { fetch: http, maxRetryDelayMs: 30_000 });

    const started = Date.now();
    const request = api.yandex('тест', { signal: controller.signal });
    setTimeout(() => controller.abort(), 20);

    await assert.rejects(() => request, AbortError);

    assert.ok(Date.now() - started < 1000, 'отмена не должна ждать конца паузы');
    assert.equal(http.calls.length, 1);
  });
});
