/** Органический результат выдачи. */
export interface SearchResult {
  /** Адрес страницы в выдаче. */
  url: string;
  /** Домен страницы. */
  domain: string;
  /** Заголовок результата. */
  title: string;
  /** Текст сниппета. */
  passage: string;
  /** Хлебные крошки результата. */
  breadcrumbs?: string;
  /** Тип документа: pdf, doc, xls. Отсутствует у обычных страниц. */
  mime?: string;
  /** Тот же тип полностью: application/pdf. */
  mime_type?: string;
}

/** Источник, на который опирается ответ нейросети. */
export interface AiAnswerSource {
  /** Номер источника: им подписаны сноски у Яндекса и Bing. */
  id: number;
  url: string;
  domain: string;
  /** У Google обрезан многоточием — так его показывает сам Google. */
  title?: string;
  /** Только Яндекс. */
  description?: string;
  /** Сколько сносок ведёт на источник. Только Яндекс и Bing. */
  citations?: number;
}

/**
 * Блок нейросети над выдачей: Алиса AI, AI Overview, Copilot. Приходит
 * только при `ai: 1` и только если поисковик его показал.
 */
export interface AiAnswer {
  /** Текст ответа; у Яндекса и Bing сноски — markdown-ссылки. */
  markdown: string;
  /** Источники. У Google список не отдаётся, если он пуст. */
  sources?: AiAnswerSource[];
  /** Только Яндекс: уточняющие вопросы под ответом. */
  followUps?: string[];
}

/** Быстрая ссылка под текстом объявления. */
export interface AdSitelink {
  /** Подпись ссылки. */
  title: string;
  /** Адрес, очищенный от кликовых меток. Приходит не всегда. */
  url?: string;
  /** Пояснение под ссылкой. Показывает только Яндекс. */
  description?: string;
}

/** Рекламное объявление со страницы выдачи. */
export interface Ad {
  /** Где стоял блок относительно органики. */
  block: 'top' | 'bottom' | 'inline';
  /** Место среди объявлений своего блока, с единицы. */
  position: number;
  /** Страница выдачи, на которой объявление нашлось. Нумерация с нуля, абсолютная. */
  page: number;
  /** Домен рекламодателя. */
  domain: string;
  /** Посадочная страница без меток. Нет, если адрес не вычислен. */
  url?: string;
  /** Адрес в том виде, в каком его показывают человеку. */
  displayUrl?: string;
  /** Заголовок объявления. */
  title?: string;
  /** Текст объявления. */
  description?: string;
  /** Чем поисковик пометил объявление: «Реклама», Sponsored, ArrowTop. */
  label?: string;
  /** Как объявление свёрстано. Только Яндекс. */
  format?: 'text' | 'gallery';
  /** Номер карусели, только у `format: 'gallery'`. Только Яндекс. */
  group?: number;
  /** Быстрые ссылки. */
  sitelinks?: AdSitelink[];
}

/** Ответ органической выдачи — общий для Яндекса, Google и Bing. */
export interface SearchResponse {
  /** Сколько страниц получено — ровно за них и списано. */
  pages: number;
  /** Выдача закончилась, повторять с большим `pages` незачем. */
  exhausted: boolean;
  /** Поиск остановлен доменом из `break_domain`. */
  breakDomainHit: boolean;
  /** Запрос после исправления поисковиком. */
  query: string;
  /** Запрос, как его отправил клиент. */
  rawQuery: string;
  /** Подпись региона выдачи, если поисковик её отдал. */
  region?: string;
  /** Только Google: почему часть результатов скрыта. */
  filter_description?: string;
  /** Только Яндекс: сколько нашлось, округлённо самим поисковиком. */
  found?: number | null;
  /** Только Яндекс: та же величина словами. */
  found_human?: string;
  /** Только Bing: фактический рынок выдачи. */
  mkt?: string;
  /** Только Bing: фактический язык интерфейса выдачи. */
  lang?: string;
  /** Только Яндекс: регион, в котором фактически выполнен поиск. */
  lr?: number;
  /** Адрес страницы выдачи в поисковике. */
  url?: string;
  results: SearchResult[];
  /** Только при `ai: 1` и только если поисковик ответ показал. */
  aiAnswer?: AiAnswer;
  /** Только при `ads: 1`. Пустой массив — просили, но рекламы не было. */
  ads?: Ad[];
}

/** Карточка картинки: первые четыре поля есть всегда. */
export interface ImageResult {
  /** Адрес самого файла картинки у первоисточника. */
  url: string;
  /** Заголовок карточки — обычно заголовок страницы-источника. */
  title: string;
  /** Домен страницы-источника, а не CDN картинки. */
  domain: string;
  /** Страница, на которой картинка стоит. */
  sourceUrl: string;
  /** Превью поисковика; у Google первые карточки приходят как data:. */
  thumbnail?: string;
  /** Ширина оригинала. Нет, если размер не назван. */
  width?: number;
  /** Высота оригинала. */
  height?: number;
  /** Ширина превью. Только Яндекс. */
  thumbnailWidth?: number;
  /** Высота превью. Только Яндекс. */
  thumbnailHeight?: number;
  /** Вес оригинала в байтах. Только Яндекс. */
  bytes?: number;
}

/** Ответ поиска по картинкам — общий для всех трёх поисковиков. */
export interface ImagesResponse {
  /** Сколько страниц получено. */
  pages: number;
  /** Выдача закончилась. */
  exhausted: boolean;
  query: string;
  /** Адрес страницы выдачи в поисковике. */
  url?: string;
  results: ImageResult[];
  /** Только при `ads: 1` и только у картинок Яндекса. */
  ads?: Ad[];
}

/** Карточка видео. url, title и domain есть всегда. */
export interface VideoResult {
  /** Страница с роликом у первоисточника. */
  url: string;
  title: string;
  domain: string;
  /** Кадр-заставка на CDN поисковика. */
  thumbnail?: string;
  /** Длительность в секундах. Нет поля — длина неизвестна, а не ноль. */
  duration?: number;
  /** Длительность подписью поисковика: 31:18, 1:02:44. */
  durationText?: string;
  /** Дата публикации в unix-секундах. Только Яндекс. */
  published?: number;
  /** Дата публикации словами поисковика, на языке выдачи. */
  publishedText?: string;
  /** Просмотры подписью: 6,8K. Точного значения за ними нет. */
  views?: string;
  /** Площадка: YouTube, VK Видео. */
  provider?: string;
  /** Канал или автор внутри площадки. Только Bing. */
  channel?: string;
  /** Текст сниппета. Только Яндекс. */
  description?: string;
  /** Путь под заголовком. Только Google. */
  breadcrumbs?: string;
}

/** Ответ поиска по видео — общий для всех трёх поисковиков. */
export interface VideoResponse {
  pages: number;
  exhausted: boolean;
  query: string;
  url?: string;
  results: VideoResult[];
}

/** Ответ поисковых подсказок. */
export interface SuggestResponse {
  query: string;
  results: string[];
  /** Только Яндекс: регион, в котором собраны подсказки. */
  lr?: string;
}

/** Регион Яндекса из справочника. */
export interface YandexRegion {
  id: number;
  name: string;
  /** Что это за регион: область, республика, страна. */
  subname: string;
  lat: number;
  lon: number;
}

/** Ответ справочника регионов Яндекса. */
export interface YandexRegionsResponse {
  name: string;
  lang: string;
  regions: YandexRegion[];
}

/** Регион Google из справочника: вместе с ID приходит готовый uule. */
export interface GoogleRegion {
  id: number;
  name: string;
  subname: string;
  type: string;
  type_name: string;
  canonical_name: string;
  /** Готовая строка UULE для параметра `uule`. */
  uule: string;
  lat: number;
  lon: number;
}

/** Ответ справочника регионов Google. */
export interface GoogleRegionsResponse {
  name: string;
  lang: string;
  regions: GoogleRegion[];
}

/** Строка списка запросов Вордстата. */
export interface WordstatPhrase {
  text: string;
  value: number;
}

/** Ответ со списками популярных и похожих запросов. */
export interface WordstatResponse {
  text: string;
  region: string;
  device: string;
  results: {
    /** Что ищут вместе с этой фразой. */
    popular: WordstatPhrase[];
    /** Соседняя семантика. */
    associations: WordstatPhrase[];
  };
  /**
   * Почему данных нет: Вордстат не принял фразу из-за синтаксиса операторов.
   * Ответ при этом удачный и оплаченный, а результаты пустые. У обычного
   * ответа поля нет.
   */
  error?: string;
}

/** Ответ с частотой запроса. */
export interface WordstatFrequencyResponse {
  text: string;
  region: string;
  device: string;
  results: {
    /** Частота запроса одним числом. */
    totalValue: number;
  };
  /**
   * Почему данных нет: Вордстат не принял фразу из-за синтаксиса операторов.
   * Ответ при этом удачный и оплаченный, а результаты пустые. У обычного
   * ответа поля нет.
   */
  error?: string;
}

/** Точка динамики показов. */
export interface WordstatGraphPoint {
  /** Дата начала периода. */
  date: string;
  /** Подпись периода словами: «июнь 2026». */
  text: string;
  /** Показы за период. */
  absolute: number;
  /** Доля среди всех показов Яндекса. */
  relative: number;
}

/** Ответ с динамикой запроса. */
export interface WordstatGraphResponse {
  text: string;
  region: string;
  device: string;
  /** Шаг динамики, который применился. */
  type: string;
  results: {
    graph: WordstatGraphPoint[];
  };
  /**
   * Почему данных нет: Вордстат не принял фразу из-за синтаксиса операторов.
   * Ответ при этом удачный и оплаченный, а результаты пустые. У обычного
   * ответа поля нет.
   */
  error?: string;
}

/** Строка географии показов. */
export interface WordstatMapRow {
  /** Разрез строки: regions или cities. */
  type: string;
  /** Название региона или города. */
  text: string;
  /** Показы. */
  absolute: number;
  /** Affinity-индекс: 100 — средний интерес, выше — повышенный. */
  popularity: number;
  /** Доля среди всех показов Яндекса. */
  relative: number;
  /** ID региона для `region`; null, если название неоднозначно. */
  region_id: number | null;
}

/** Ответ с географией запроса. */
export interface WordstatMapResponse {
  text: string;
  device: string;
  type: string;
  results: {
    rows: WordstatMapRow[];
  };
  /**
   * Почему данных нет: Вордстат не принял фразу из-за синтаксиса операторов.
   * Ответ при этом удачный и оплаченный, а результаты пустые. У обычного
   * ответа поля нет.
   */
  error?: string;
}

/** Прогноз по одному месту аукциона. */
export interface DirectPosition {
  /** Ставка. */
  bid: number;
  /** Бюджет за период. */
  budget: number;
  /** Прогноз кликов. */
  clicks: number;
  /** Прогноз CTR в процентах. */
  ctr: number;
  /** Прогноз показов. */
  shows: number;
}

/** Прогноз по одной фразе. */
export interface DirectForecast {
  phrase: string;
  /** Сколько раз объявление будет показано за период. */
  shows: number;
  /** Места аукциона: набор задаёт сам Директ. */
  positions: Record<string, DirectPosition>;
}

/** Ответ прогноза показов Яндекс Директа. */
export interface DirectResponse {
  /** Регион, по которому считался прогноз. */
  geo: number;
  period: string;
  /** На сколько пачек разбит список — по ним считается стоимость. */
  batches: number;
  /** Сколько пачек посчитано. */
  processed: number;
  results: DirectForecast[];
  /** Ошибки Директа по отдельным фразам. */
  errors: string[];
}

/** Ответ геолокации по IP. */
export interface GeoipResponse {
  ip: string;
  latitude: number;
  longitude: number;
  /** ID тот же, что у Яндекса: годится для `region`. */
  region: {
    id: number;
    name: string;
  };
  country: {
    id: number;
    name: string;
    iso_name: string;
  };
}

/** Ответ с остатком на счёте. */
export interface BalanceResponse {
  balance: number;
  currency: string;
}
