import type { ParamValue } from './common.js';
import { type ClientOptions, type RequestOptions } from './http.js';
import type { BingImagesParams, BingSearchParams, BingSuggestParams, BingVideoParams, DirectParams, GeoipParams, GoogleImagesParams, GoogleSearchParams, GoogleSuggestParams, GoogleVideoParams, RegionsParams, WordstatGraphParams, WordstatMapParams, WordstatParams, YandexImagesParams, YandexSearchParams, YandexSuggestParams, YandexVideoParams } from './params.js';
import type { BalanceResponse, DirectResponse, GeoipResponse, GoogleRegionsResponse, ImagesResponse, SearchResponse, SuggestResponse, VideoResponse, WordstatFrequencyResponse, WordstatGraphResponse, WordstatMapResponse, WordstatResponse, YandexRegionsResponse } from './responses.js';
/**
 * Клиент JSON SEO API.
 *
 * ```ts
 * const client = new JsonSeoClient('ВАШ_КЛЮЧ');
 * const serp = await client.yandex({ text: 'купить ноутбук', region: 213 });
 * ```
 */
export declare class JsonSeoClient {
    private readonly http;
    constructor(apiKey: string, options?: Omit<ClientOptions, 'apiKey'>);
    constructor(options: ClientOptions);
    /** Органическая выдача Яндекса: мобильная, регион 213. 0.01 ₽ за страницу. */
    yandex(params: string | YandexSearchParams, options?: RequestOptions): Promise<SearchResponse>;
    /** Подсказки Яндекса: до 50 фраз с учётом региона. 0.01 ₽ за запрос. */
    yandexSuggest(params: string | YandexSuggestParams, options?: RequestOptions): Promise<SuggestResponse>;
    /** Код региона (lr) по названию города или области. Бесплатно, нужен ключ. */
    yandexRegions(params: string | RegionsParams, options?: RequestOptions): Promise<YandexRegionsResponse>;
    /** Картинки Яндекса: 20 карточек на страницу, 0.01 ₽ за страницу. */
    yandexImages(params: string | YandexImagesParams, options?: RequestOptions): Promise<ImagesResponse>;
    /** Видео Яндекса: 20 карточек на страницу, 0.01 ₽ за страницу. */
    yandexVideo(params: string | YandexVideoParams, options?: RequestOptions): Promise<VideoResponse>;
    /** Органическая выдача google.com: мобильная, 0.01 ₽ за страницу. */
    google(params: string | GoogleSearchParams, options?: RequestOptions): Promise<SearchResponse>;
    /** Подсказки Google: до ~15 фраз. 0.01 ₽ за запрос. */
    googleSuggest(params: string | GoogleSuggestParams, options?: RequestOptions): Promise<SuggestResponse>;
    /** ID региона Google по названию и готовый `uule`. Бесплатно, нужен ключ. */
    googleRegions(params: string | RegionsParams, options?: RequestOptions): Promise<GoogleRegionsResponse>;
    /** Картинки Google: 100 карточек на страницу, 0.01 ₽ за страницу. */
    googleImages(params: string | GoogleImagesParams, options?: RequestOptions): Promise<ImagesResponse>;
    /** Видео Google: 10 карточек на страницу, 0.01 ₽ за страницу. */
    googleVideo(params: string | GoogleVideoParams, options?: RequestOptions): Promise<VideoResponse>;
    /** Органическая выдача bing.com: без локации — Россия, 0.01 ₽ за страницу. */
    bing(params: string | BingSearchParams, options?: RequestOptions): Promise<SearchResponse>;
    /** Подсказки Bing. 0.01 ₽ за запрос. */
    bingSuggest(params: string | BingSuggestParams, options?: RequestOptions): Promise<SuggestResponse>;
    /** Картинки Bing: `count` карточек (по умолчанию 35), дальше 700-й не листает. */
    bingImages(params: string | BingImagesParams, options?: RequestOptions): Promise<ImagesResponse>;
    /** Видео Bing: `count` карточек на страницу, по умолчанию 105. */
    bingVideo(params: string | BingVideoParams, options?: RequestOptions): Promise<VideoResponse>;
    /** Популярные и похожие запросы. 0.01 ₽ за запрос. */
    wordstat(params: string | WordstatParams, options?: RequestOptions): Promise<WordstatResponse>;
    /** Частота запроса одним числом — `results.totalValue`. 0.01 ₽ за запрос. */
    wordstatFrequency(params: string | WordstatParams, options?: RequestOptions): Promise<WordstatFrequencyResponse>;
    /** Динамика показов по месяцам, неделям или дням. 0.01 ₽ за запрос. */
    wordstatGraph(params: string | WordstatGraphParams, options?: RequestOptions): Promise<WordstatGraphResponse>;
    /**
     * Показы по регионам и городам. `popularity` — affinity-индекс: 100 —
     * средний интерес. 0.01 ₽ за запрос.
     */
    wordstatMap(params: string | WordstatMapParams, options?: RequestOptions): Promise<WordstatMapResponse>;
    /**
     * Прогноз показов Директа со ставками и бюджетом. Кабинет не нужен.
     *
     * 0.01 ₽ за пачку до 4000 символов (около 150 фраз). До 1000 фраз за
     * запрос, 100 запросов в час.
     */
    direct(params: string | ReadonlyArray<string> | DirectParams, options?: RequestOptions): Promise<DirectResponse>;
    /** Страна, регион и координаты по IPv4. Бесплатно, нужен ключ. */
    geoip(params: string | GeoipParams, options?: RequestOptions): Promise<GeoipResponse>;
    /** Текущий баланс. Бесплатно, нужен ключ. */
    balance(options?: RequestOptions): Promise<BalanceResponse>;
    /** Произвольный метод API — если в сервисе появился новый. */
    call<T = unknown>(path: string, params?: Record<string, ParamValue>, options?: RequestOptions): Promise<T>;
    /** То же, но ответ возвращается строкой без разбора. */
    callRaw(path: string, params?: Record<string, ParamValue>, options?: RequestOptions): Promise<string>;
}
