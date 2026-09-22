import type { ParamValue } from './common.js';
import { InvalidArgumentError } from './errors.js';
import { HttpClient, type ClientOptions, type RequestOptions } from './http.js';
import type {
  BingImagesParams,
  BingSearchParams,
  BingSuggestParams,
  BingVideoParams,
  DirectParams,
  GeoipParams,
  GoogleImagesParams,
  GoogleSearchParams,
  GoogleSuggestParams,
  GoogleVideoParams,
  RegionsParams,
  WordstatGraphParams,
  WordstatMapParams,
  WordstatParams,
  YandexImagesParams,
  YandexSearchParams,
  YandexSuggestParams,
  YandexVideoParams,
} from './params.js';
import type {
  BalanceResponse,
  DirectResponse,
  GeoipResponse,
  GoogleRegionsResponse,
  ImagesResponse,
  SearchResponse,
  SuggestResponse,
  VideoResponse,
  WordstatFrequencyResponse,
  WordstatGraphResponse,
  WordstatMapResponse,
  WordstatResponse,
  YandexRegionsResponse,
} from './responses.js';

/**
 * Клиент JSON SEO API.
 *
 * ```ts
 * const client = new JsonSeoClient('ВАШ_КЛЮЧ');
 * const serp = await client.yandex({ text: 'купить ноутбук', region: 213 });
 * ```
 */
export class JsonSeoClient {
  private readonly http: HttpClient;

  constructor(apiKey: string, options?: Omit<ClientOptions, 'apiKey'>);
  constructor(options: ClientOptions);
  constructor(first: string | ClientOptions, second: Omit<ClientOptions, 'apiKey'> = {}) {
    this.http = new HttpClient(typeof first === 'string' ? { ...second, apiKey: first } : first);
  }

  // Яндекс

  /**
   * Органическая выдача Яндекса. По умолчанию мобильная, регион 213 (Москва).
   * Стоимость: 0.01 ₽ за страницу.
   */
  async yandex(params: string | YandexSearchParams, options?: RequestOptions): Promise<SearchResponse> {
    return this.http.json('yandex', primary(params, 'text'), options);
  }

  /**
   * Поисковые подсказки Яндекса: до 50 фраз без персонализации, с учётом
   * региона. Стоимость: 0.01 ₽ за запрос.
   */
  async yandexSuggest(params: string | YandexSuggestParams, options?: RequestOptions): Promise<SuggestResponse> {
    return this.http.json('yandex/suggest', primary(params, 'text'), options);
  }

  /**
   * Справочник регионов: код региона (lr) по названию города или области.
   * Бесплатно, но ключ обязателен — по нему считается лимит.
   */
  async yandexRegions(params: string | RegionsParams, options?: RequestOptions): Promise<YandexRegionsResponse> {
    return this.http.json('yandex/regions', primary(params, 'name'), options);
  }

  /**
   * Поиск по картинкам. Страница вертикали — 20 карточек.
   * Стоимость: 0.01 ₽ за страницу.
   */
  async yandexImages(params: string | YandexImagesParams, options?: RequestOptions): Promise<ImagesResponse> {
    return this.http.json('yandex/images', primary(params, 'q'), options);
  }

  /**
   * Поиск по видео. Страница вертикали — 20 карточек.
   * Стоимость: 0.01 ₽ за страницу.
   */
  async yandexVideo(params: string | YandexVideoParams, options?: RequestOptions): Promise<VideoResponse> {
    return this.http.json('yandex/video', primary(params, 'q'), options);
  }

  // Google

  /**
   * Органическая выдача google.com. По умолчанию мобильная.
   * Стоимость: 0.01 ₽ за страницу.
   */
  async google(params: string | GoogleSearchParams, options?: RequestOptions): Promise<SearchResponse> {
    return this.http.json('google', primary(params, 'q'), options);
  }

  /**
   * Подсказки Google (autocomplete): до ~15 фраз без персонализации.
   * Стоимость: 0.01 ₽ за запрос.
   */
  async googleSuggest(params: string | GoogleSuggestParams, options?: RequestOptions): Promise<SuggestResponse> {
    return this.http.json('google/suggest', primary(params, 'q'), options);
  }

  /**
   * Справочник регионов Google: числовой ID по названию и готовый `uule`.
   * Бесплатно, ключ обязателен.
   */
  async googleRegions(params: string | RegionsParams, options?: RequestOptions): Promise<GoogleRegionsResponse> {
    return this.http.json('google/regions', primary(params, 'name'), options);
  }

  /**
   * Поиск по картинкам. Страница вертикали — 100 карточек.
   * Стоимость: 0.01 ₽ за страницу.
   */
  async googleImages(params: string | GoogleImagesParams, options?: RequestOptions): Promise<ImagesResponse> {
    return this.http.json('google/images', primary(params, 'q'), options);
  }

  /**
   * Поиск по видео. Страница вертикали — 10 карточек.
   * Стоимость: 0.01 ₽ за страницу.
   */
  async googleVideo(params: string | GoogleVideoParams, options?: RequestOptions): Promise<VideoResponse> {
    return this.http.json('google/video', primary(params, 'q'), options);
  }

  // Bing

  /**
   * Органическая выдача bing.com. Без параметров локации — выдача по России.
   * Стоимость: 0.01 ₽ за страницу.
   */
  async bing(params: string | BingSearchParams, options?: RequestOptions): Promise<SearchResponse> {
    return this.http.json('bing', primary(params, 'q'), options);
  }

  /** Подсказки Bing (autocomplete). Стоимость: 0.01 ₽ за запрос. */
  async bingSuggest(params: string | BingSuggestParams, options?: RequestOptions): Promise<SuggestResponse> {
    return this.http.json('bing/suggest', primary(params, 'q'), options);
  }

  /**
   * Поиск по картинкам. Страница вертикали — `count` карточек, по умолчанию
   * 35. Дальше 700-й карточки Bing не листает.
   */
  async bingImages(params: string | BingImagesParams, options?: RequestOptions): Promise<ImagesResponse> {
    return this.http.json('bing/images', primary(params, 'q'), options);
  }

  /**
   * Поиск по видео. Страница вертикали — `count` карточек, по умолчанию 105.
   */
  async bingVideo(params: string | BingVideoParams, options?: RequestOptions): Promise<VideoResponse> {
    return this.http.json('bing/video', primary(params, 'q'), options);
  }

  // Вордстат

  /**
   * Списки популярных и похожих запросов — материал для расширения
   * семантики. Стоимость: 0.01 ₽ за запрос.
   */
  async wordstat(params: string | WordstatParams, options?: RequestOptions): Promise<WordstatResponse> {
    return this.http.json('wordstat', primary(params, 'text'), options);
  }

  /**
   * Частота запроса одним числом — `results.totalValue`.
   * Стоимость: 0.01 ₽ за запрос.
   */
  async wordstatFrequency(
    params: string | WordstatParams,
    options?: RequestOptions,
  ): Promise<WordstatFrequencyResponse> {
    return this.http.json('wordstat/frequency', primary(params, 'text'), options);
  }

  /**
   * Динамика показов по месяцам, неделям или дням — сезонность и тренд.
   * Стоимость: 0.01 ₽ за запрос.
   */
  async wordstatGraph(params: string | WordstatGraphParams, options?: RequestOptions): Promise<WordstatGraphResponse> {
    return this.http.json('wordstat/graph', primary(params, 'text'), options);
  }

  /**
   * Распределение показов по регионам и городам. `popularity` — это
   * affinity-индекс: 100 — средний интерес, выше — повышенный.
   * Стоимость: 0.01 ₽ за запрос.
   */
  async wordstatMap(params: string | WordstatMapParams, options?: RequestOptions): Promise<WordstatMapResponse> {
    return this.http.json('wordstat/map', primary(params, 'text'), options);
  }

  // Директ и служебные методы

  /**
   * Прогноз показов Яндекс Директа со ставками и бюджетом по местам
   * аукциона. Рекламный кабинет не нужен.
   *
   * Стоимость: 0.01 ₽ за пачку фраз до 4000 символов — около 150 обычных
   * фраз. Не больше 100 запросов в час на аккаунт; в один запрос помещается
   * до 1000 фраз.
   */
  async direct(
    params: string | ReadonlyArray<string> | DirectParams,
    options?: RequestOptions,
  ): Promise<DirectResponse> {
    return this.http.json('direct', primary(params, 'phrases'), options);
  }

  /**
   * Страна, регион и координаты по IPv4-адресу. ID региона совпадает с ID
   * региона Яндекса. Бесплатно, ключ обязателен.
   */
  async geoip(params: string | GeoipParams, options?: RequestOptions): Promise<GeoipResponse> {
    return this.http.json('geoip', primary(params, 'ip'), options);
  }

  /** Текущий баланс аккаунта. Бесплатно, ключ обязателен. */
  async balance(options?: RequestOptions): Promise<BalanceResponse> {
    return this.http.json('balance', {}, options);
  }

  // Запасной выход

  /**
   * Произвольный метод API — на случай, если в сервисе появился новый,
   * а SDK ещё не обновлён.
   */
  async call<T = unknown>(
    path: string,
    params: Record<string, ParamValue> = {},
    options?: RequestOptions,
  ): Promise<T> {
    return this.http.json<T>(path, params, options);
  }

  /** То же, но ответ возвращается строкой без разбора. */
  async callRaw(path: string, params: Record<string, ParamValue> = {}, options?: RequestOptions): Promise<string> {
    return this.http.text(path, params, options);
  }
}

/**
 * Позволяет вызывать метод и одним запросом: `yandex('купить ноутбук')`
 * вместо `yandex({ text: 'купить ноутбук' })`, а `direct()` — сразу списком
 * фраз.
 */
function primary(
  params: string | ReadonlyArray<string> | Record<string, ParamValue>,
  key: string,
): Record<string, ParamValue> {
  if (typeof params === 'string' || Array.isArray(params)) {
    return { [key]: params as ParamValue };
  }

  if (params === null || typeof params !== 'object') {
    throw new InvalidArgumentError('Параметры метода передаются строкой, массивом или объектом.');
  }

  return params as Record<string, ParamValue>;
}
