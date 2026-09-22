# JSON SEO Node SDK

Официальный клиент [JSON SEO API](https://jsonseo.ru) для JavaScript и TypeScript: выдача Яндекса, Google и Bing, картинки и видео, поисковые подсказки, Яндекс Вордстат, прогноз показов Директа и геолокация по IP.

- Написан на TypeScript, типы едут в пакете — отдельный `@types` не нужен.
- Работает в **Node 18+, Bun и Deno**, в ESM и в CommonJS.
- Без зависимостей: только штатный `fetch`.
- Двадцать один метод сервиса.
- Три попытки на запрос по умолчанию: если сервис затупил, SDK сходит ещё раз сам.

## Установка

```bash
npm install jsonseo
# или
bun add jsonseo
```

Ключ берётся в [личном кабинете](https://jsonseo.ru).

## Быстрый старт

```ts
import { JsonSeoClient } from 'jsonseo';

const client = new JsonSeoClient('ВАШ_КЛЮЧ');

const serp = await client.yandex({
  text: 'купить ноутбук',
  region: 213,
});

serp.results.forEach((result, index) => {
  console.log(`${index + 1}. ${result.domain} — ${result.title}`);
});
```

CommonJS тоже поддерживается:

```js
const { JsonSeoClient } = require('jsonseo');
```

Если у метода один обязательный параметр, его можно передать просто строкой:

```ts
await client.yandex('купить ноутбук');
await client.geoip('77.88.55.242');
await client.wordstatFrequency('ремонт айфона');
```

---

# Примеры запросов

## Позиции сайта в Яндексе

`break_domain` останавливает сбор на нужном домене — платить за страницы ниже найденной позиции незачем.

```ts
const serp = await client.yandex({
  text: 'ремонт айфона',
  region: 213,              // Москва
  pages: 10,                // до 100 позиций
  break_domain: 'example.com',
});

const position = serp.results.findIndex((r) => r.domain.endsWith('example.com'));

console.log(position === -1 ? 'не найден' : `Позиция: ${position + 1}`);
console.log(`Собрано страниц: ${serp.pages}`);
console.log(`Нашлось всего: ${serp.found_human}`);
```

В ответе:

```jsonc
{
  "pages": 3,
  "exhausted": false,
  "breakDomainHit": true,          // остановились на нужном домене
  "query": "ремонт айфона",
  "rawQuery": "ремонт айфона",
  "found": 28000000,
  "found_human": "нашлось 28 млн результатов",
  "lr": 213,
  "url": "https://yandex.ru/search/?text=...",
  "results": [
    {
      "url": "https://example.com/remont-iphone/",
      "domain": "example.com",
      "title": "Ремонт айфонов в Москве",
      "passage": "Починим за 30 минут...",
      "breadcrumbs": "example.com › услуги"
    }
  ]
}
```

## Выдача Google по нужному городу

Регион задаётся числовым ID из справочника — сервис сам соберёт `uule` и подставит `gl`.

```ts
const { regions } = await client.googleRegions('Казань');

const serp = await client.google({
  q: 'заказать пиццу',
  region: regions[0].id,
  hl: 'ru',
  device: 'desktop',
  pages: 2,
});
```

Если Google схлопнул часть результатов как «очень похожие», причина придёт в `filter_description`, а вернуть их можно параметром `filter`:

```ts
const serp = await client.google({ q: 'заказать пиццу', filter: 0 });
```

## Выдача Bing

```ts
const serp = await client.bing({
  q: 'buy a laptop',
  mkt: 'en-US',
  pages: 2,
});

console.log(serp.mkt, serp.lang);  // фактический рынок и язык
```

## Реклама на странице выдачи

Приходит отдельным массивом, органика не меняется. Стоит +0.01 ₽ за страницу, на которой реклама нашлась.

```ts
const serp = await client.yandex({
  text: 'пластиковые окна',
  region: 213,
  ads: true,
});

for (const ad of serp.ads ?? []) {
  console.log(`${ad.block} #${ad.position} — ${ad.domain}`);
  console.log(`   ${ad.title}`);
}
```

`block` — где стоял блок: `top` до органики, `bottom` после неё, `inline` между результатами. Пустой массив `ads` значит «рекламу просили, но её не было», а отсутствие поля — «не просили».

## Ответ нейросети над выдачей

```ts
const serp = await client.yandex({
  text: 'чем отличается osb от фанеры',
  ai: true,
});

if (serp.aiAnswer) {
  console.log(serp.aiAnswer.markdown);

  for (const source of serp.aiAnswer.sources ?? []) {
    console.log(`[${source.id}] ${source.domain}`);
  }
}
```

Стоит +0.01 ₽ и только когда ответ есть: если поисковик его не показал, запрос обойдётся в обычную цену. Доступен только с первой страницы.

## Картинки

```ts
const images = await client.yandexImages({
  q: 'скандинавский интерьер',
  orientation: 'horizontal',
  size: 'large',
  format: 'jpg',
  pages: 2,
});

for (const image of images.results) {
  console.log(`${image.width}×${image.height} ${image.url}`);
  console.log(`   источник: ${image.sourceUrl}`);
}
```

Те же параметры работают у `googleImages()` и `bingImages()` — SDK переводит общий фильтр в родной параметр движка. Если у поисковика такого значения нет, придёт `ValidationError` с указанием, чем заменить.

## Видео

```ts
const videos = await client.googleVideo({
  q: 'как заменить ремень грм',
  duration: 'long',
  hl: 'ru',
});

for (const video of videos.results) {
  console.log(`${video.title} — ${video.durationText}`);
  console.log(`   ${video.url} (${video.provider})`);
}
```

Поле `duration` приходит в секундах, но не всегда: у прямых эфиров вместо длины стоит `LIVE`. Отбор вида `duration < 600` молча выбросит такие ролики — ориентируйтесь на `durationText`, он на месте всегда.

## Поисковые подсказки

```ts
const suggest = await client.yandexSuggest({ text: 'купить кв', region: 213 });

console.log(suggest.results);
// ['купить квартиру в москве', 'купить квартиру в новостройке', ...]
```

Есть у всех трёх поисковиков: `yandexSuggest()`, `googleSuggest()`, `bingSuggest()`.

## Справочник регионов

```ts
const { regions } = await client.yandexRegions('Казань');

for (const region of regions) {
  console.log(`${region.id} — ${region.name} (${region.subname})`);
}
// 43 — Казань (Республика Татарстан)
```

Бесплатно, но ключ нужен: по нему считается лимит запросов в минуту. У `googleRegions()` в ответе дополнительно приходит готовая строка `uule`.

## Вордстат: частота запроса

```ts
const frequency = await client.wordstatFrequency({
  text: 'ремонт айфона',
  kind: 'exact',       // точная частотность: "!ремонт !айфона"
  region: 213,
});

console.log(frequency.results.totalValue);  // 27356
```

Вид частотности задаётся параметром `kind`, кавычки и операторы расставит сервис — фразу передавайте как есть:

| `kind` | Что считает |
| --- | --- |
| `base` | Базовая: фраза как есть |
| `phrase` | Фразовая: `"фраза"` |
| `exact` | Точная: `"!слово !слово"` — для прогноза трафика берут её |
| `superexact` | Сверхточная: `"[!слово !слово]"` |

## Вордстат: расширение семантики

```ts
const wordstat = await client.wordstat({ text: 'ремонт айфона', region: [213, 2] });

for (const phrase of wordstat.results.popular) {
  console.log(phrase.value, phrase.text);
}

for (const phrase of wordstat.results.associations) {
  console.log(phrase.value, phrase.text);
}
```

`popular` — что ищут вместе с фразой, `associations` — соседняя семантика.

## Вордстат: сезонность

```ts
const graph = await client.wordstatGraph({
  text: 'купить ёлку',
  graph_type: 'month',
});

for (const point of graph.results.graph) {
  console.log(point.text, point.absolute);
}
// июнь 2026 9042
// июль 2026 11780
```

`month` и `week` отдают историю с 2018 года, `day` — последние 60 дней.

## Вордстат: география спроса

```ts
const map = await client.wordstatMap({ text: 'купить ноутбук', map_type: 'regions' });

for (const row of map.results.rows) {
  console.log(row.text, row.absolute, `индекс ${row.popularity}`);
}
```

`popularity` — affinity-индекс: 100 означает средний по стране интерес, выше — повышенный. В каждой строке приходит `region_id`, его можно сразу подставить в `region` других методов.

## Прогноз показов Яндекс Директа

Рекламный кабинет не нужен. Список фраз передаётся массивом — SDK склеит его сам.

```ts
const forecast = await client.direct({
  phrases: ['ремонт айфона', 'замена экрана iphone', '"ремонт айфона"'],
  region: 213,
  period: 'month',
});

for (const row of forecast.results) {
  console.log(`${row.phrase}: ${row.shows} показов`);

  for (const [place, bid] of Object.entries(row.positions)) {
    console.log(`   ${place}: ставка ${bid.bid} ₽, бюджет ${bid.budget} ₽, кликов ${bid.clicks}`);
  }
}
```

Вид частотности задаётся операторами прямо во фразе: `ремонт айфона` — базовая, `"ремонт айфона"` — фразовая, `"!ремонт !айфона"` — точная.

Стоимость — 0.01 ₽ за пачку до 4000 символов, это около 150 обычных фраз. За один запрос принимается до 1000 фраз, на аккаунт — не больше 100 запросов в час.

## Геолокация по IP

```ts
const geo = await client.geoip('77.88.55.242');

console.log(`${geo.country.name}, ${geo.region.name}`);
console.log(geo.latitude, geo.longitude);
```

ID региона тот же, что у Яндекса, — его можно сразу подставить в `region` методов выдачи и Вордстата:

```ts
const serp = await client.yandex({
  text: 'доставка пиццы',
  region: geo.region.id,
});
```

## Баланс

```ts
const { balance, currency } = await client.balance();

console.log(balance, currency);  // 123.45 RUB
```

---

# Справочник методов

| Метод | Путь API | Что делает |
| --- | --- | --- |
| `yandex(params)` | `/yandex` | Органическая выдача Яндекса |
| `yandexSuggest(params)` | `/yandex/suggest` | Поисковые подсказки |
| `yandexRegions(params)` | `/yandex/regions` | Справочник регионов, бесплатно |
| `yandexImages(params)` | `/yandex/images` | Поиск по картинкам |
| `yandexVideo(params)` | `/yandex/video` | Поиск по видео |
| `google(params)` | `/google` | Органическая выдача Google |
| `googleSuggest(params)` | `/google/suggest` | Подсказки |
| `googleRegions(params)` | `/google/regions` | Регионы и готовый `uule`, бесплатно |
| `googleImages(params)` | `/google/images` | Поиск по картинкам |
| `googleVideo(params)` | `/google/video` | Поиск по видео |
| `bing(params)` | `/bing` | Органическая выдача Bing |
| `bingSuggest(params)` | `/bing/suggest` | Подсказки |
| `bingImages(params)` | `/bing/images` | Поиск по картинкам |
| `bingVideo(params)` | `/bing/video` | Поиск по видео |
| `wordstat(params)` | `/wordstat` | Популярные и похожие запросы |
| `wordstatFrequency(params)` | `/wordstat/frequency` | Частота запроса одним числом |
| `wordstatGraph(params)` | `/wordstat/graph` | Динамика по месяцам, неделям, дням |
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

# Как SDK помогает с параметрами

**Списки передаются массивами.** Фразы для Директа склеиваются переводом строки, остальные списки — запятой:

```ts
await client.direct(['ремонт айфона', 'ремонт телефона', 'замена экрана']);
await client.wordstat({ text: 'ремонт', region: [213, 2], device: ['desktop', 'phone'] });
```

**Флаги принимаются флагами.** `true` и `false` уезжают как `1` и `0`:

```ts
await client.yandex({ text: 'купить ноутбук', ai: true, ads: true });
```

**`null`, `undefined` и пустой массив не отправляются.** Необязательный параметр, который вы ещё не посчитали, можно не вычищать из объекта руками.

**Родные параметры поисковиков проходят насквозь.** Вертикали принимают не только общие фильтры, но и `tbs` у Google, `isize` у Яндекса, `qft` у Bing — типы это допускают.

# Ошибки

Всё, что бросает SDK, наследуется от `JsonSeoError`.

| Ошибка | Статус | Когда |
| --- | --- | --- |
| `ValidationError` | 422 | Параметры не приняты. `errors` — сообщения по полям, `fields` — их имена |
| `UnauthorizedError` | 403, 401 | Ключ не передан или недействителен |
| `PaymentRequiredError` | 402 | На счёте не хватает средств |
| `RateLimitError` | 429 | Превышен лимит частоты |
| `ServiceUnavailableError` | 503 | Выдачу получить не вышло. Деньги не списаны |
| `JsonSeoApiError` | прочие | Любой другой отказ сервиса |

У всех ошибок сервиса есть `status`, `body`, разобранный `payload` и `retryAfter` — срок, который назвал сервис, если он его назвал.

| Ошибка | Когда |
| --- | --- |
| `NetworkError` | До сервиса не достучались: сеть, DNS, TLS |
| `TimeoutError` | Ответа не дождались |
| `IncompleteResponseError` | Соединение оборвалось посреди тела |
| `ParseError` | Ответ пришёл, но не разобрался как JSON. `body` — тело как есть |
| `AbortError` | Запрос отменён через `AbortSignal` |
| `InvalidArgumentError` | SDK забраковал аргументы, запрос не отправлялся |

```ts
import { PaymentRequiredError, RateLimitError, ValidationError } from 'jsonseo';

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
  } else if (error instanceof RateLimitError) {
    console.error(`Вернуться через ${error.retryAfter} с`);
  } else {
    throw error;
  }
}
```

# Повторы

**У каждого запроса три попытки по умолчанию: одна основная и две повторных.** Если сервис затупил и выдачу собрать не вышло (`503`), SDK сам сходит ещё дважды, и обычно этого хватает. `attempts: 1` отключает повторы совсем.

`429`, `5xx` и обрывы связи повторяются автоматически — это ровно те отказы, за которые сервис денег не берёт. Отказы по ключу, балансу и параметрам не повторяются: сами они не изменятся.

Таймаут и оборвавшееся посреди тела соединение не повторяются, и это намеренно: работу на стороне сервиса обрыв у клиента не отменяет — выдача будет собрана и оплачена, а повтор стоил бы ещё раз. Если ответ не успевает прийти, поднимайте `timeoutMs`, а не `attempts`.

Пауза между попытками удваивается и разбавляется случайной добавкой. Если сервис прислал `Retry-After`, SDK не вернётся раньше названного срока. Когда сервис просит ждать дольше `maxRetryDelayMs`, SDK не ждёт вовсе, а отдаёт ошибку с полем `retryAfter` — решение остаётся за вами.

Пауза прерывается переданным `AbortSignal`: отмена срабатывает сразу, а не в конце ожидания.

# Настройки клиента

```ts
const client = new JsonSeoClient({
  apiKey: 'ВАШ_КЛЮЧ',
  baseUrl: 'https://jsonseo.ru/api', // адрес API
  timeoutMs: 300_000,                // сколько ждать ответа на одну попытку
  attempts: 3,                       // всего попыток, вместе с первой
  retryDelayMs: 1_000,               // стартовая пауза между попытками
  maxRetryDelayMs: 30_000,           // потолок паузы
  auth: 'header',                    // или 'query' — ключ в параметре key
  userAgent: 'мой-проект/1.0',
  fetch: myFetch,                    // своя реализация fetch
});
```

Незнакомая настройка отвергается сразу — опечатка не превратится в молча взятое значение по умолчанию.

Таймаут по умолчанию намеренно большой: многостраничный запрос выдачи собирается минутами. Считается он на **каждую попытку** отдельно, а не на весь вызов: при `attempts: 3` худший случай — три таймаута подряд.

Ключ по умолчанию едет в заголовке `Authorization: Bearer`, а не в адресе: так он не оседает в логах прокси и серверов. `auth: 'query'` нужен там, где заголовки до API не доходят.

# Отмена и таймаут отдельного запроса

Вторым аргументом любой метод принимает `signal` и `timeoutMs`:

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);

await client.yandex('купить ноутбук', { signal: controller.signal, timeoutMs: 60_000 });
```

# Разработка

```bash
npm install
npm test             # сборка и тесты на node:test
npm run typecheck
npm run smoke        # проверка собранного пакета в текущей среде
npm run check:consumer   # собранный пакет ставится в чистый проект и типизуется
```

Тесты идут без сети: `fetch` подменяется заглушкой. Тот же набор гоняется
и в Bun (`bun test test/`), и в Deno (`deno test --allow-all --no-check`),
на Linux, macOS и Windows.

# Лицензия

MIT.
