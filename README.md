# JSON SEO Node SDK

Официальный клиент [JSON SEO API](https://jsonseo.ru) для JavaScript и TypeScript: выдача Яндекса, Google и Bing, вертикали картинок и видео, Вордстат, прогноз показов Яндекс Директа и геолокация по IP.

- Написан на TypeScript, типы едут в пакете — отдельный `@types` не нужен.
- Работает в **Node 18+, Bun и Deno**, в ESM и в CommonJS.
- Без зависимостей: только штатный `fetch`.
- Двадцать один метод сервиса: органика, вертикали картинок и видео, подсказки, справочники регионов, Вордстат, Директ, геолокация и баланс.
- Временные отказы повторяются сами, постоянные — сразу превращаются в понятные ошибки.

## Установка

```bash
npm install jsonseo
# или
bun add jsonseo
```

## Быстрый старт

```ts
import { JsonSeoClient } from 'jsonseo';

const client = new JsonSeoClient('ВАШ_КЛЮЧ');

const serp = await client.yandex({
  text: 'купить ноутбук',
  region: 213,
  pages: 2,
});

serp.results.forEach((result, index) => {
  console.log(`${index + 1}. ${result.domain} — ${result.title}`);
});
```

CommonJS тоже поддерживается:

```js
const { JsonSeoClient } = require('jsonseo');
```

Ключ берётся в [личном кабинете](https://jsonseo.ru). Если у метода один обязательный параметр, его можно передать строкой:

```ts
await client.yandex('купить ноутбук');
await client.geoip('77.88.55.242');
await client.wordstatFrequency('ремонт айфона');
```

## Методы

Все методы возвращают промис с разобранным ответом.

### Яндекс

| Метод | Путь API | Что делает |
| --- | --- | --- |
| `yandex(params)` | `/yandex` | Органическая выдача |
| `yandexSuggest(params)` | `/yandex/suggest` | Поисковые подсказки |
| `yandexRegions(params)` | `/yandex/regions` | Справочник регионов, бесплатно |
| `yandexImages(params)` | `/yandex/images` | Поиск по картинкам |
| `yandexVideo(params)` | `/yandex/video` | Поиск по видео |

### Google

| Метод | Путь API | Что делает |
| --- | --- | --- |
| `google(params)` | `/google` | Органическая выдача |
| `googleSuggest(params)` | `/google/suggest` | Подсказки (autocomplete) |
| `googleRegions(params)` | `/google/regions` | Справочник регионов и готовый `uule`, бесплатно |
| `googleImages(params)` | `/google/images` | Поиск по картинкам |
| `googleVideo(params)` | `/google/video` | Поиск по видео |

### Bing

| Метод | Путь API | Что делает |
| --- | --- | --- |
| `bing(params)` | `/bing` | Органическая выдача |
| `bingSuggest(params)` | `/bing/suggest` | Подсказки |
| `bingImages(params)` | `/bing/images` | Поиск по картинкам |
| `bingVideo(params)` | `/bing/video` | Поиск по видео |

### Вордстат, Директ и служебные

| Метод | Путь API | Что делает |
| --- | --- | --- |
| `wordstat(params)` | `/wordstat` | Популярные и похожие запросы |
| `wordstatFrequency(params)` | `/wordstat/frequency` | Частота запроса одним числом |
| `wordstatGraph(params)` | `/wordstat/graph` | Динамика по месяцам, неделям или дням |
| `wordstatMap(params)` | `/wordstat/map` | География показов |
| `direct(params)` | `/direct` | Прогноз показов Яндекс Директа |
| `geoip(params)` | `/geoip` | Геолокация по IPv4, бесплатно |
| `balance()` | `/balance` | Остаток на счёте, бесплатно |

Параметры каждого метода описаны типами: редактор подскажет имена и допустимые значения прямо на месте вызова. Полное описание — в [документации](https://jsonseo.ru/docs).

Появился метод, которого ещё нет в SDK? Его можно вызвать напрямую:

```ts
await client.call<МойТип>('новый/метод', { параметр: 'значение' }); // разберёт JSON
await client.callRaw('новый/метод', { параметр: 'значение' });      // вернёт тело как есть
```

## Как SDK помогает с параметрами

**Списки передаются массивами.** Фразы для Директа склеиваются переводом строки, остальные списки — запятой:

```ts
await client.direct(['ремонт айфона', 'ремонт телефона', 'замена экрана']);
await client.wordstat({ text: 'ремонт', region: [213, 2], device: ['desktop', 'phone'] });
```

**Флаги принимаются флагами.** `true` и `false` уезжают как `1` и `0`:

```ts
await client.yandex({ text: 'купить ноутбук', ai: true, ads: true });
```

**`null` и `undefined` не отправляются.** Необязательный параметр, который вы ещё не посчитали, можно не вычищать из объекта руками.

**Родные параметры поисковиков проходят насквозь.** Вертикали принимают не только общие фильтры, но и `tbs` у Google, `isize` у Яндекса, `qft` у Bing — типы это допускают.

## Ошибки

Всё, что бросает SDK, наследуется от `JsonSeoError`.

| Ошибка | Статус | Когда |
| --- | --- | --- |
| `ValidationError` | 422 | Параметры не приняты. `errors` — сообщения по полям, `fields` — их имена |
| `UnauthorizedError` | 403 | Ключ не передан или недействителен |
| `PaymentRequiredError` | 402 | На счёте не хватает средств |
| `RateLimitError` | 429 | Превышен лимит частоты. `retryAfter` — через сколько секунд повторить |
| `ServiceUnavailableError` | 503 | Выдачу получить не вышло. Деньги не списаны |
| `JsonSeoApiError` | прочие | Любой другой отказ сервиса |
| `NetworkError` | — | До сервиса не достучались: сеть, DNS, TLS |
| `TimeoutError` | — | Ответа не дождались (наследник `NetworkError`) |
| `IncompleteResponseError` | — | Соединение оборвалось посреди тела (наследник `NetworkError`) |
| `ParseError` | — | Ответ пришёл, но не разобрался как JSON. `body` — тело как есть |
| `AbortError` | — | Запрос отменён через `AbortSignal` |
| `InvalidArgumentError` | — | SDK забраковал аргументы, запрос не отправлялся |

У всех ошибок сервиса есть `status`, `body`, разобранный `payload` и `retryAfter` — срок, который назвал сервис, если он его назвал.

```ts
import { PaymentRequiredError, ValidationError } from 'jsonseo';

try {
  const serp = await client.yandex({ text: 'купить ноутбук', pages: 50 });
} catch (error) {
  if (error instanceof ValidationError) {
    for (const [field, messages] of Object.entries(error.errors)) {
      console.error(`${field}: ${messages.join(', ')}`);
    }
  } else if (error instanceof PaymentRequiredError) {
    const { balance } = await client.balance();
    console.error(`Баланс кончился: ${balance}`);
  } else {
    throw error;
  }
}
```

## Повторы

`429`, `5xx` и обрывы связи повторяются автоматически — это ровно те отказы, за которые сервис денег не берёт. Отказы по ключу, балансу и параметрам не повторяются: сами они не изменятся.

Таймаут и оборвавшееся посреди тела соединение не повторяются, и это намеренно: работу на стороне сервиса обрыв у клиента не отменяет — выдача будет собрана и оплачена, а повтор стоил бы ещё раз. Если ответ не успевает прийти, поднимайте `timeoutMs`, а не `retries`.

Пауза между попытками удваивается и разбавляется случайной добавкой. Если сервис прислал `Retry-After`, SDK не вернётся раньше названного срока: проснуться раньше — значит гарантированно получить тот же отказ. Когда сервис просит ждать дольше `maxRetryDelayMs`, SDK не ждёт вовсе, а отдаёт ошибку с полем `retryAfter` — решение остаётся за вами.

Пауза прерывается переданным `AbortSignal`: отмена срабатывает сразу, а не в конце ожидания.

## Настройки клиента

```ts
const client = new JsonSeoClient({
  apiKey: 'ВАШ_КЛЮЧ',
  baseUrl: 'https://jsonseo.ru/api', // адрес API
  timeoutMs: 300_000,                // сколько ждать ответа на одну попытку
  retries: 2,                        // сколько раз повторять временный отказ
  retryDelayMs: 1_000,               // стартовая пауза между попытками
  maxRetryDelayMs: 30_000,           // потолок паузы
  auth: 'header',                    // или 'query' — ключ в параметре key
  userAgent: 'мой-проект/1.0',
  fetch: myFetch,                    // своя реализация fetch
});
```

Таймаут по умолчанию намеренно большой: многостраничный запрос выдачи собирается минутами. Считается он на **каждую попытку** отдельно, а не на весь вызов: при `retries: 2` худший случай — три таймаута подряд.

Ключ по умолчанию едет в заголовке `Authorization: Bearer`, а не в адресе: так он не оседает в логах прокси и серверов. `auth: 'query'` нужен там, где заголовки до API не доходят.

## Отмена и таймаут отдельного запроса

Вторым аргументом любой метод принимает `signal` и `timeoutMs`:

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);

await client.yandex('купить ноутбук', { signal: controller.signal, timeoutMs: 60_000 });
```

## Разработка

```bash
npm install
npm test          # сборка и тесты на node:test
npm run typecheck
npm run smoke     # проверка собранного пакета: node scripts/smoke.mjs или bun scripts/smoke.mjs
```

Тесты идут без сети: `fetch` подменяется заглушкой.

## Лицензия

MIT.
