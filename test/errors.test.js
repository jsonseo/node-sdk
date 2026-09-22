import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  JsonSeoApiError,
  JsonSeoClient,
  PaymentRequiredError,
  RateLimitError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
} from '../dist/esm/index.js';
import { fakeFetch } from './helpers.js';

/** Повторы выключены: здесь проверяется разбор отказа, а не поведение при нём. */
function client(fetchImpl) {
  return new JsonSeoClient('KEY', { fetch: fetchImpl, retries: 0 });
}

describe('ошибки сервиса', () => {
  it('нехватка средств — PaymentRequiredError', async () => {
    const http = fakeFetch().json({ message: 'На аккаунте недостаточно средств для завершения запроса.' }, 402);

    await assert.rejects(() => client(http).yandex('тест'), (error) => {
      assert.ok(error instanceof PaymentRequiredError);
      assert.equal(error.status, 402);
      assert.equal(error.message, 'На аккаунте недостаточно средств для завершения запроса.');

      return true;
    });
  });

  it('плохой ключ — UnauthorizedError', async () => {
    const http = fakeFetch().json({ message: 'Недействительный токен авторизации.' }, 403);

    await assert.rejects(() => client(http).yandex('тест'), UnauthorizedError);
  });

  it('ошибка валидации несёт сообщения по полям', async () => {
    const http = fakeFetch().json({ message: 'Введите запрос', errors: { text: ['Введите запрос'] } }, 422);

    await assert.rejects(() => client(http).yandex(''), (error) => {
      assert.ok(error instanceof ValidationError);
      assert.deepEqual(error.errors, { text: ['Введите запрос'] });
      assert.deepEqual(error.fields, ['text']);

      return true;
    });
  });

  it('ошибка валидации без полей отдаёт пустой список', async () => {
    const http = fakeFetch().json({ message: 'Что-то не так' }, 422);

    await assert.rejects(() => client(http).yandex('тест'), (error) => {
      assert.deepEqual(error.errors, {});

      return true;
    });
  });

  it('лимит частоты сохраняет Retry-After', async () => {
    const http = fakeFetch().json({ message: 'Too Many Attempts.' }, 429, { 'retry-after': '17' });

    await assert.rejects(() => client(http).yandex('тест'), (error) => {
      assert.ok(error instanceof RateLimitError);
      assert.equal(error.retryAfter, 17);

      return true;
    });
  });

  it('лимит частоты без заголовка оставляет retryAfter пустым', async () => {
    const http = fakeFetch().json({ message: 'Too Many Attempts.' }, 429);

    await assert.rejects(() => client(http).yandex('тест'), (error) => {
      assert.equal(error.retryAfter, null);

      return true;
    });
  });

  it('сорвавшийся поиск — ServiceUnavailableError', async () => {
    const http = fakeFetch().json({ message: 'Сервис временно недоступен.' }, 503);

    await assert.rejects(() => client(http).yandex('тест'), ServiceUnavailableError);
  });

  it('незнакомый статус всё равно становится ошибкой API', async () => {
    const http = fakeFetch().json({ message: 'Чайник' }, 418);

    await assert.rejects(() => client(http).yandex('тест'), (error) => {
      assert.ok(error instanceof JsonSeoApiError);
      assert.equal(error.status, 418);

      return true;
    });
  });

  it('тело не в JSON не теряет статус', async () => {
    const http = fakeFetch().raw('<html>502 Bad Gateway</html>', 502);

    await assert.rejects(() => client(http).yandex('тест'), (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.body, '<html>502 Bad Gateway</html>');
      assert.deepEqual(error.payload, {});
      assert.equal(error.message, 'JSON SEO API вернул ошибку 502.');

      return true;
    });
  });

  it('имя класса сохраняется в name', async () => {
    const http = fakeFetch().json({ message: 'Недействительный токен авторизации.' }, 403);

    await assert.rejects(() => client(http).yandex('тест'), (error) => {
      assert.equal(error.name, 'UnauthorizedError');

      return true;
    });
  });
});
