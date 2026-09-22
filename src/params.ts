import type {
  AdultFilter,
  BingSafeSearch,
  Device,
  DirectPeriod,
  Flag,
  Freshness,
  GoogleSafeSearch,
  ImageColor,
  ImageFormat,
  ImageOrientation,
  ImageSize,
  ImageType,
  MobileDevice,
  ParamValue,
  RegionLanguage,
  VideoDuration,
  WordstatGraphType,
  WordstatKind,
  WordstatMapType,
  YandexZone,
} from './common.js';

/**
 * Основа всех наборов параметров. Запись открыта не для удобства: вертикали
 * принимают и родные параметры поисковиков — tbs, isize, qft, — перечислить
 * которые нельзя, они меняются вместе с поисковиками.
 */
export interface BaseParams {
  [param: string]: ParamValue;
}

/** Параметры органической выдачи Яндекса. */
export interface YandexSearchParams extends BaseParams {
  /** Поисковый запрос. */
  text: string;
  /** ID региона Яндекса из справочника `yandexRegions()`. По умолчанию 213 (Москва). */
  region?: number;
  /** Сколько страниц выдачи собрать, 1–20. */
  pages?: number;
  /** С какой страницы начать, нумерация с нуля. `page + pages` больше 20 — ошибка. */
  page?: number;
  /** Смещение в единицах Яндекса — номер страницы с нуля. Старше `page`. */
  p?: number;
  /** Фильтрация результатов поиска. */
  filter?: AdultFilter;
  /** Выделять слова запроса в title и passage тегами `<hlword>`. */
  hlword?: Flag;
  /** Отключить автоматическое исправление запроса. */
  noreask?: Flag;
  /** Доменная зона поиска. */
  zone?: YandexZone;
  /** Устройство. По умолчанию выдача мобильная. */
  device?: Device;
  /** Домен, на котором остановить поиск: дешевле и быстрее, когда нужна только позиция. */
  break_domain?: string;
  /** Забрать «Быстрый ответ Алисы AI». Только с первой страницы, +0.01 ₽ когда ответ есть. */
  ai?: Flag;
  /** Добавить рекламные блоки отдельным массивом `ads`. +0.01 ₽ за страницу с рекламой. */
  ads?: Flag;
}

/** Параметры подсказок Яндекса. */
export interface YandexSuggestParams extends BaseParams {
  /** Запрос-префикс, для которого нужны подсказки. */
  text: string;
  /** ID региона Яндекса: подсказки региональные. */
  region?: number;
  /** Доменная зона поиска. */
  zone?: YandexZone;
}

/** Параметры справочников регионов — одинаковые у Яндекса и Google. */
export interface RegionsParams extends BaseParams {
  /** Название города или области, можно частично. Число ищется как ID региона. */
  name: string | number;
  /** Язык названий в ответе. */
  lang?: RegionLanguage;
}

/** Параметры поиска по картинкам у Яндекса. */
export interface YandexImagesParams extends BaseParams {
  /** Поисковый запрос. */
  q: string;
  /** Сколько страниц вертикали собрать. Страница здесь — 20 карточек. */
  pages?: number;
  /** С какой страницы вертикали начать, нумерация с нуля. */
  page?: number;
  /** Смещение в единицах Яндекса. Старше `page`. */
  p?: number;
  /** ID региона Яндекса. По умолчанию 213 (Москва). */
  region?: number;
  /** Домен Яндекса: ru, com, kz, by, uz, tr, com.tr. */
  zone?: string;
  /** Семейный поиск. */
  family?: Flag;
  /** Фильтрация взрослого контента. */
  filter?: AdultFilter;
  /** Размер картинки. */
  size?: ImageSize;
  /** Ориентация картинки. */
  orientation?: ImageOrientation;
  /** Цвет. pink и brown у Яндекса отсутствуют и возвращают 422. */
  color?: ImageColor;
  /** Тип изображения. transparent у Яндекса отсутствует. */
  type?: ImageType;
  /** Формат файла. */
  format?: ImageFormat;
  /** Свежесть. У Яндекса поддерживаются только week и month. */
  freshness?: Freshness;
  /** Отбор по сайту: домен без протокола и пути. */
  site?: string;
  /** Добавить рекламные блоки отдельным массивом `ads`. */
  ads?: Flag;
}

/** Параметры поиска по видео у Яндекса. */
export interface YandexVideoParams extends BaseParams {
  /** Поисковый запрос. */
  q: string;
  /** Сколько страниц вертикали собрать. Страница здесь — 20 карточек. */
  pages?: number;
  /** С какой страницы вертикали начать, нумерация с нуля. */
  page?: number;
  /** Смещение в единицах Яндекса. Старше `page`. */
  p?: number;
  /** ID региона Яндекса. */
  region?: number;
  /** Домен Яндекса. */
  zone?: string;
  /** Семейный поиск. */
  family?: Flag;
  /** Фильтрация взрослого контента. */
  filter?: AdultFilter;
  /** Длительность ролика. */
  duration?: VideoDuration;
  /** Только в высоком качестве. */
  hd?: Flag | string;
  /** Свежесть. У Яндекса окно одно и не настраивается — любое значение вернёт 422. */
  freshness?: Freshness;
  /** Только эта площадка: домен без протокола и пути. */
  site?: string;
}

/** Параметры органической выдачи Google. */
export interface GoogleSearchParams extends BaseParams {
  /** Поисковый запрос. */
  q: string;
  /** ID региона Google из справочника `googleRegions()`: по нему строятся uule и gl. */
  region?: number;
  /** Сколько страниц выдачи собрать, 1–20. */
  pages?: number;
  /** С какой страницы начать, нумерация с нуля. */
  page?: number;
  /** Смещение в единицах Google: номер результата с нуля, кратный десяти. Старше `page`. */
  start?: number;
  /** Код страны ISO: ru, us, de. */
  gl?: string;
  /** Язык интерфейса: ru, en, de, принимается и en-US. */
  hl?: string;
  /** Закодированная геолокация Google. */
  uule?: string;
  /** Координаты в формате longitude,latitude. Работают, только если нет uule и region. */
  ll?: string;
  /** Отключить автоматическое исправление запроса. */
  nfpr?: Flag;
  /** Устройство. По умолчанию выдача мобильная. */
  device?: MobileDevice;
  /** `0` возвращает результаты, схлопнутые как «очень похожие». Причина обрезки — в `filter_description`. */
  filter?: Flag;
  /** Безопасный поиск. */
  safe?: GoogleSafeSearch;
  /** Домен, на котором остановить поиск. */
  break_domain?: string;
  /** Доменная зона Google (ccTLD), по умолчанию com. */
  zone?: string;
  /** Забрать AI Overview. Только с первой страницы, +0.01 ₽ когда обзор есть. */
  ai?: Flag;
  /** Добавить рекламные блоки отдельным массивом `ads`. */
  ads?: Flag;
}

/** Параметры подсказок Google. */
export interface GoogleSuggestParams extends BaseParams {
  /** Запрос-префикс. */
  q: string;
  /** ID региона Google. */
  region?: number;
  /** Код страны — главный рычаг региональности, если region не задан. */
  gl?: string;
  /** Язык интерфейса. */
  hl?: string;
  /** Закодированная геолокация Google. */
  uule?: string;
  /** Доменная зона Google. На подсказки почти не влияет. */
  zone?: string;
}

/** Общие параметры вертикалей Google — картинок и видео. */
interface GoogleVerticalParams extends BaseParams {
  /** Поисковый запрос. */
  q: string;
  /** Сколько страниц вертикали собрать. */
  pages?: number;
  /** С какой страницы вертикали начать, нумерация с нуля. */
  page?: number;
  /** Смещение в единицах Google. Старше `page`. */
  start?: number;
  /** ID региона Google: из него собираются uule и gl. */
  region?: number;
  /** Готовая строка UULE. Старше region. */
  uule?: string;
  /** Координаты longitude,latitude. */
  ll?: string;
  /** Язык интерфейса выдачи. */
  hl?: string;
  /** Код страны выдачи. */
  gl?: string;
  /** Национальный домен Google. */
  zone?: string;
  /** SafeSearch. */
  safe?: GoogleSafeSearch;
  /** Схлопывание «очень похожих» результатов. */
  filter?: Flag;
}

/** Параметры поиска по картинкам у Google. Страница вертикали — 100 карточек. */
export interface GoogleImagesParams extends GoogleVerticalParams {
  /** Размер картинки. Меньшая ступень у Google — значки ровно 256 px. */
  size?: ImageSize;
  /** Ориентация картинки. */
  orientation?: ImageOrientation;
  /** Цвет. */
  color?: ImageColor;
  /** Тип изображения. */
  type?: ImageType;
  /** Формат файла. */
  format?: ImageFormat;
  /** Свежесть. */
  freshness?: Freshness;
  /** Отбор по сайту: домен без протокола и пути. */
  site?: string;
}

/** Параметры поиска по видео у Google. Страница вертикали — 10 карточек. */
export interface GoogleVideoParams extends GoogleVerticalParams {
  /** Длительность ролика. */
  duration?: VideoDuration;
  /** Только в высоком качестве. */
  hd?: Flag | string;
  /** Свежесть ролика. */
  freshness?: Freshness;
  /** Только эта площадка. У Google задаётся строкой tbs=srcf:, поэтому вернёт 422. */
  site?: string;
}

/** Параметры органической выдачи Bing. */
export interface BingSearchParams extends BaseParams {
  /** Поисковый запрос. */
  q: string;
  /** Сколько страниц выдачи собрать, 1–20. */
  pages?: number;
  /** Рынок в формате язык-страна: ru-RU, en-US. */
  mkt?: string;
  /** Код страны: RU, US. */
  cc?: string;
  /** Координаты в формате latitude,longitude. */
  ll?: string;
  /** Язык интерфейса. Регион не меняет. */
  setlang?: string;
  /** Устройство. По умолчанию выдача мобильная. */
  device?: MobileDevice;
  /** Фильтрация результатов. */
  safesearch?: BingSafeSearch;
  /** Домен, на котором остановить поиск. Поддерживает маску `*.example.com`. */
  break_domain?: string;
  /** С какой страницы начать, нумерация с нуля. */
  page?: number;
  /** Смещение в единицах Bing: номер результата с единицы. Старше `page`. */
  first?: number;
  /** Забрать ответ Copilot. +0.01 ₽ когда ответ есть. */
  ai?: Flag;
}

/** Параметры подсказок Bing. */
export interface BingSuggestParams extends BaseParams {
  /** Запрос-префикс. */
  q: string;
  /** Координаты latitude,longitude — делают подсказки региональными. */
  ll?: string;
  /** Рынок. По умолчанию ru-RU. */
  mkt?: string;
  /** Код страны. */
  cc?: string;
  /** Язык интерфейса. */
  setlang?: string;
}

/** Общие параметры вертикалей Bing — картинок и видео. */
interface BingVerticalParams extends BaseParams {
  /** Поисковый запрос. */
  q: string;
  /** Сколько страниц вертикали собрать. Страница — `count` карточек. */
  pages?: number;
  /** С какой страницы вертикали начать. Дальше 700-й карточки Bing не листает. */
  page?: number;
  /** Смещение в единицах Bing: номер карточки с единицы. Старше `page`. */
  first?: number;
  /** Сколько карточек просить на страницу. Цена страницы от этого не зависит. */
  count?: number;
  /** Рынок. */
  mkt?: string;
  /** Код страны. */
  cc?: string;
  /** Язык интерфейса. */
  setlang?: string;
  /** Координаты latitude,longitude. */
  ll?: string;
  /** Фильтрация результатов. */
  safesearch?: BingSafeSearch;
}

/** Параметры поиска по картинкам у Bing. Потолок `count` — 35. */
export interface BingImagesParams extends BingVerticalParams {
  /** Размер картинки. */
  size?: ImageSize;
  /** Ориентация картинки. */
  orientation?: ImageOrientation;
  /** Цвет. */
  color?: ImageColor;
  /** Тип изображения. */
  type?: ImageType;
  /** Формат файла. У Bing выбирается только gif. */
  format?: ImageFormat;
  /** Свежесть. */
  freshness?: Freshness;
  /** Отбор по сайту. У Bing в картинках его нет — вернёт 422. */
  site?: string;
}

/** Параметры поиска по видео у Bing. Потолок `count` — 105. */
export interface BingVideoParams extends BingVerticalParams {
  /** Длительность ролика. */
  duration?: VideoDuration;
  /** Только в высоком качестве: у Bing это 720p и выше. */
  hd?: Flag | string;
  /** Свежесть ролика. */
  freshness?: Freshness;
  /** Только эта площадка. */
  site?: string;
}

/** Общие параметры методов Вордстата. */
export interface WordstatParams extends BaseParams {
  /** Ключевое слово или фраза. Операторы передаются как есть. */
  text: string;
  /** Вид частотности: операторы расставляются автоматически. */
  kind?: WordstatKind;
  /** ID регионов Яндекса. Массив склеивается запятой. */
  region?: string | number | ReadonlyArray<string | number>;
  /** Типы устройств: desktop, phone, tablet. */
  device?: string | ReadonlyArray<string>;
}

/** Параметры динамики запроса. */
export interface WordstatGraphParams extends WordstatParams {
  /** Шаг динамики. */
  graph_type?: WordstatGraphType;
}

/** Параметры географии запроса. Параметр `region` здесь не применяется. */
export interface WordstatMapParams extends BaseParams {
  /** Ключевое слово или фраза. */
  text: string;
  /** Вид частотности. */
  kind?: WordstatKind;
  /** Типы устройств. */
  device?: string | ReadonlyArray<string>;
  /** Разрез: по регионам, по городам или всё вместе. */
  map_type?: WordstatMapType;
}

/** Параметры прогноза показов Яндекс Директа. */
export interface DirectParams extends BaseParams {
  /**
   * Ключевые фразы, не больше 1000 за запрос. Массив склеивается переводом
   * строки. Вид частотности задаётся операторами прямо во фразе.
   */
  phrases: string | ReadonlyArray<string>;
  /** ID региона Яндекса. По умолчанию 225 (Россия). */
  region?: number;
  /** Период прогноза. */
  period?: DirectPeriod;
  /** Номер периода — календарный, а не смещение вперёд. */
  period_num?: number;
}

/** Параметры геолокации по IP. */
export interface GeoipParams extends BaseParams {
  /** IPv4-адрес. */
  ip: string;
}
