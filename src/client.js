"use strict";
import { InvalidArgumentError } from './errors.js';
import { HttpClient } from './http.js';
/**
 * Клиент JSON SEO API.
 *
 * ```ts
 * const client = new JsonSeoClient('ВАШ_КЛЮЧ');
 * const serp = await client.yandex({ text: 'купить ноутбук', region: 213 });
 * ```
 */
export class JsonSeoClient {
    constructor(first, second = {}) {
        this.http = new HttpClient(typeof first === 'string' ? { ...second, apiKey: first } : first);
    }
    // Яндекс
    /** Органическая выдача Яндекса: мобильная, регион 213. 0.01 ₽ за страницу. */
    async yandex(params, options) {
        return this.http.json('yandex', primary(params, 'text'), options);
    }
    /** Подсказки Яндекса: до 50 фраз с учётом региона. 0.01 ₽ за запрос. */
    async yandexSuggest(params, options) {
        return this.http.json('yandex/suggest', primary(params, 'text'), options);
    }
    /** Код региона (lr) по названию города или области. Бесплатно, нужен ключ. */
    async yandexRegions(params, options) {
        return this.http.json('yandex/regions', primary(params, 'name'), options);
    }
    /** Картинки Яндекса: 20 карточек на страницу, 0.01 ₽ за страницу. */
    async yandexImages(params, options) {
        return this.http.json('yandex/images', primary(params, 'q'), options);
    }
    /** Видео Яндекса: 20 карточек на страницу, 0.01 ₽ за страницу. */
    async yandexVideo(params, options) {
        return this.http.json('yandex/video', primary(params, 'q'), options);
    }
    // Google
    /** Органическая выдача google.com: мобильная, 0.01 ₽ за страницу. */
    async google(params, options) {
        return this.http.json('google', primary(params, 'q'), options);
    }
    /** Подсказки Google: до ~15 фраз. 0.01 ₽ за запрос. */
    async googleSuggest(params, options) {
        return this.http.json('google/suggest', primary(params, 'q'), options);
    }
    /** ID региона Google по названию и готовый `uule`. Бесплатно, нужен ключ. */
    async googleRegions(params, options) {
        return this.http.json('google/regions', primary(params, 'name'), options);
    }
    /** Картинки Google: 100 карточек на страницу, 0.01 ₽ за страницу. */
    async googleImages(params, options) {
        return this.http.json('google/images', primary(params, 'q'), options);
    }
    /** Видео Google: 10 карточек на страницу, 0.01 ₽ за страницу. */
    async googleVideo(params, options) {
        return this.http.json('google/video', primary(params, 'q'), options);
    }
    // Bing
    /** Органическая выдача bing.com: без локации — Россия, 0.01 ₽ за страницу. */
    async bing(params, options) {
        return this.http.json('bing', primary(params, 'q'), options);
    }
    /** Подсказки Bing. 0.01 ₽ за запрос. */
    async bingSuggest(params, options) {
        return this.http.json('bing/suggest', primary(params, 'q'), options);
    }
    /** Картинки Bing: `count` карточек (по умолчанию 35), дальше 700-й не листает. */
    async bingImages(params, options) {
        return this.http.json('bing/images', primary(params, 'q'), options);
    }
    /** Видео Bing: `count` карточек на страницу, по умолчанию 105. */
    async bingVideo(params, options) {
        return this.http.json('bing/video', primary(params, 'q'), options);
    }
    // Вордстат
    /** Популярные и похожие запросы. 0.01 ₽ за запрос. */
    async wordstat(params, options) {
        return this.http.json('wordstat', primary(params, 'text'), options);
    }
    /** Частота запроса одним числом — `results.totalValue`. 0.01 ₽ за запрос. */
    async wordstatFrequency(params, options) {
        return this.http.json('wordstat/frequency', primary(params, 'text'), options);
    }
    /** Динамика показов по месяцам, неделям или дням. 0.01 ₽ за запрос. */
    async wordstatGraph(params, options) {
        return this.http.json('wordstat/graph', primary(params, 'text'), options);
    }
    /**
     * Показы по регионам и городам. `popularity` — affinity-индекс: 100 —
     * средний интерес. 0.01 ₽ за запрос.
     */
    async wordstatMap(params, options) {
        return this.http.json('wordstat/map', primary(params, 'text'), options);
    }
    // Директ и служебные методы
    /**
     * Прогноз показов Директа со ставками и бюджетом. Кабинет не нужен.
     *
     * 0.01 ₽ за пачку до 4000 символов (около 150 фраз). До 1000 фраз за
     * запрос, 100 запросов в час.
     */
    async direct(params, options) {
        return this.http.json('direct', primary(params, 'phrases'), options);
    }
    /** Страна, регион и координаты по IPv4. Бесплатно, нужен ключ. */
    async geoip(params, options) {
        return this.http.json('geoip', primary(params, 'ip'), options);
    }
    /** Текущий баланс. Бесплатно, нужен ключ. */
    async balance(options) {
        return this.http.json('balance', {}, options);
    }
    // Запасной выход
    /** Произвольный метод API — если в сервисе появился новый. */
    async call(path, params = {}, options) {
        return this.http.json(path, params, options);
    }
    /** То же, но ответ возвращается строкой без разбора. */
    async callRaw(path, params = {}, options) {
        return this.http.text(path, params, options);
    }
}
/** Даёт вызывать метод строкой или, для `direct()`, списком фраз. */
function primary(params, key) {
    if (typeof params === 'string' || Array.isArray(params)) {
        return { [key]: params };
    }
    if (params === null || typeof params !== 'object') {
        throw new InvalidArgumentError('Параметры метода передаются строкой, массивом или объектом.');
    }
    return params;
}
