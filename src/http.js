"use strict";
import { AbortError, apiErrorFor, IncompleteResponseError, InvalidArgumentError, JsonSeoError, NetworkError, ParseError, TimeoutError, } from './errors.js';
const DEFAULT_BASE_URL = 'https://jsonseo.ru/api';
/**
 * Ключи проверяются типом: забытая здесь настройка из ClientOptions
 * отвергалась бы у пользователя как незнакомая.
 */
const KNOWN_OPTIONS = {
    apiKey: true,
    baseUrl: true,
    timeoutMs: true,
    attempts: true,
    retryDelayMs: true,
    maxRetryDelayMs: true,
    auth: true,
    userAgent: true,
    fetch: true,
};
const KNOWN_OPTION_NAMES = Object.keys(KNOWN_OPTIONS);
const VERSION = '1.0.0';
/**
 * Транспорт: собирает запрос, разбирает ответ и решает, повторять ли отказ.
 *
 * @internal
 */
export class HttpClient {
    constructor(options) {
        if (typeof options.apiKey !== 'string' || options.apiKey.trim() === '') {
            throw new InvalidArgumentError('Нужен API-ключ: возьмите его в личном кабинете на https://jsonseo.ru.');
        }
        // undefined из спреда частичного конфига — не настройка, а её отсутствие.
        const unknown = Object.keys(options).filter((name) => !KNOWN_OPTION_NAMES.includes(name) && options[name] !== undefined);
        if (unknown.length > 0) {
            throw new InvalidArgumentError(`Неизвестные настройки клиента: ${unknown.join(', ')}. Доступны: ${KNOWN_OPTION_NAMES.join(', ')}.`);
        }
        // NaN сюда приезжает из Number(process.env.ЧЕГО_НЕТ), и без проверки
        // сравнение с ним всегда ложно — повторы платного запроса не кончались бы.
        if (options.attempts !== undefined && (!Number.isInteger(options.attempts) || options.attempts < 1)) {
            throw new InvalidArgumentError(`Настройка attempts ожидает целое число не меньше 1, получено: ${String(options.attempts)}.`);
        }
        if (options.auth !== undefined && options.auth !== 'header' && options.auth !== 'query') {
            throw new InvalidArgumentError(`Настройка auth принимает "header" или "query", получено: ${String(options.auth)}.`);
        }
        const fetchImpl = options.fetch ?? (typeof fetch === 'function' ? fetch : undefined);
        if (!fetchImpl) {
            throw new InvalidArgumentError('В этой среде нет глобального fetch. Нужен Node 18+, Bun или Deno — либо передайте свою реализацию настройкой fetch.');
        }
        this.apiKey = options.apiKey.trim();
        this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.timeoutMs = options.timeoutMs ?? 300000;
        this.attempts = options.attempts ?? 3;
        this.retryDelayMs = options.retryDelayMs ?? 1000;
        this.maxRetryDelayMs = options.maxRetryDelayMs ?? 30000;
        this.auth = options.auth ?? 'header';
        this.userAgent = options.userAgent ?? `jsonseo-node/${VERSION}`;
        this.fetchImpl = fetchImpl;
    }
    /** Запрос, ответ которого разбирается как JSON. */
    async json(path, params, options) {
        const body = await this.send(path, params, 'application/json', options);
        try {
            return JSON.parse(body);
        }
        catch (error) {
            // Тело кладём в ошибку: страница выдачи уже оплачена.
            throw new ParseError(`Ответ JSON SEO API не разобрался как JSON: ${error.message}.`, body);
        }
    }
    /** Запрос, ответ которого возвращается строкой без разбора. */
    text(path, params, options) {
        return this.send(path, params, 'application/xml, text/xml', options);
    }
    /**
     * Выполняет запрос, повторяя те отказы, за которые сервис не берёт денег:
     * 429, 5xx и обрывы связи до того, как ответ начал приходить.
     */
    async send(path, params, accept, options) {
        const query = encodeParams(params);
        if (this.auth === 'query') {
            query.set('key', this.apiKey);
        }
        const headers = {
            Accept: accept,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.userAgent,
        };
        if (this.auth === 'header') {
            headers.Authorization = `Bearer ${this.apiKey}`;
        }
        // Всегда POST: длинные списки фраз в GET не помещаются.
        const url = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
        const body = query.toString();
        for (let attempt = 0;; attempt++) {
            let response;
            try {
                response = await this.fetchOnce(url, headers, body, options);
            }
            catch (error) {
                // Таймаут и обрыв на середине тела не повторяем: выдача уже
                // собрана и оплачена.
                if (error instanceof NetworkError &&
                    !(error instanceof TimeoutError) &&
                    !(error instanceof IncompleteResponseError) &&
                    !this.isLastAttempt(attempt)) {
                    try {
                        await sleep(this.backoff(attempt), options?.signal);
                    }
                    catch (aborted) {
                        // Отменили во время паузы: причину ожидания не теряем.
                        aborted.cause = error;
                        throw aborted;
                    }
                    continue;
                }
                throw error;
            }
            if (response.ok) {
                return response.body;
            }
            const { retryAfter } = response;
            const error = apiErrorFor(response.status, response.body, parseQuietly(response.body), retryAfter);
            // Проснуться раньше названного срока — снова получить тот же отказ.
            // Ждать дольше потолка не станем: отдаём ошибку.
            if (this.isLastAttempt(attempt) ||
                !isRetryable(response.status) ||
                (retryAfter !== null && retryAfter * 1000 > this.maxRetryDelayMs)) {
                throw error;
            }
            // Не раньше, чем просит сервис, и не чаще своего бэкоффа:
            // Retry-After прошедшей датой даёт ноль.
            const pause = retryAfter === null ? this.backoff(attempt) : Math.max(retryAfter * 1000, this.backoff(attempt));
            await sleep(pause, options?.signal);
        }
    }
    /**
     * Один заход в сеть: таймаут и внешняя отмена сводятся в один сигнал.
     * Тело читается здесь же — fetch отдаёт ответ сразу по заголовкам, и
     * снаружи застрявшая передача висела бы без ограничения по времени.
     */
    async fetchOnce(url, headers, body, options) {
        const external = options?.signal;
        if (external?.aborted) {
            throw new AbortError('Запрос отменён до отправки.');
        }
        const controller = new AbortController();
        const timeoutMs = options?.timeoutMs ?? this.timeoutMs;
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeoutMs);
        const forward = () => controller.abort();
        external?.addEventListener('abort', forward);
        try {
            const response = await this.fetchImpl(url, {
                method: 'POST',
                headers,
                body,
                signal: controller.signal,
                redirect: 'follow',
            });
            let text;
            try {
                text = await response.text();
            }
            catch (error) {
                if (timedOut) {
                    throw new TimeoutError(`Ответа от JSON SEO API не дождались за ${timeoutMs} мс.`, error);
                }
                if (external?.aborted) {
                    throw new AbortError('Запрос отменён.');
                }
                // Тело дочитать не вышло, а выдача уже оплачена — отдельный
                // класс ошибки, повторять такое нельзя.
                throw new IncompleteResponseError(`Ответ от JSON SEO API пришёл не целиком: ${error.message}.`, error);
            }
            return {
                status: response.status,
                ok: response.ok,
                retryAfter: parseRetryAfter(response.headers.get('retry-after')),
                body: text,
            };
        }
        catch (error) {
            if (error instanceof JsonSeoError) {
                throw error;
            }
            if (timedOut) {
                throw new TimeoutError(`Ответа от JSON SEO API не дождались за ${timeoutMs} мс.`, error);
            }
            if (external?.aborted) {
                throw new AbortError('Запрос отменён.');
            }
            throw new NetworkError(`Запрос к JSON SEO API не удался: ${error.message}.`, error);
        }
        finally {
            clearTimeout(timer);
            external?.removeEventListener('abort', forward);
        }
    }
    /** Попытки нумеруются с нуля: при attempts = 3 последняя — вторая. */
    isLastAttempt(attempt) {
        return attempt + 1 >= this.attempts;
    }
    /**
     * Пауза удваивается с каждой попыткой; случайная добавка разводит
     * параллельные запросы, чтобы они не вернулись разом.
     */
    backoff(attempt) {
        const delay = this.retryDelayMs * 2 ** attempt;
        // Потолок накладывается после добавки, иначе она бы его превышала.
        return Math.min(delay + delay * 0.25 * Math.random(), this.maxRetryDelayMs);
    }
}
/** Приводит параметры к тому виду, в каком их ждёт форма запроса. */
export function encodeParams(params) {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(params)) {
        if (value === null || value === undefined) {
            continue;
        }
        if (Array.isArray(value)) {
            // Пустой список — «параметр не задан»: от region= сервис откажет.
            if (value.length === 0) {
                continue;
            }
            // Фразы — переводом строки: запятая в них встречается.
            query.set(name, value.map((item, index) => scalar(`${name}[${index}]`, item)).join(name === 'phrases' ? '\n' : ','));
            continue;
        }
        query.set(name, scalar(name, value));
    }
    return query;
}
function scalar(name, value) {
    if (typeof value === 'boolean') {
        return value ? '1' : '0';
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new InvalidArgumentError(`Параметр ${name} получил не число: ${String(value)}.`);
        }
        return String(value);
    }
    if (typeof value === 'string') {
        return value;
    }
    throw new InvalidArgumentError(`Параметр ${name} должен быть строкой, числом, флагом или массивом таких значений.`);
}
function isRetryable(status) {
    return status === 429 || status >= 500;
}
/**
 * Сколько секунд просит подождать сервис. RFC 9110 разрешает число секунд
 * и HTTP-дату, разбираются обе.
 */
function parseRetryAfter(header) {
    if (header === null) {
        return null;
    }
    const value = header.trim();
    if (/^\d+$/.test(value)) {
        return Number(value);
    }
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
        return null;
    }
    return Math.max(0, Math.round((timestamp - Date.now()) / 1000));
}
/** Тело ошибки может быть и не JSON — тогда подробностей просто нет. */
function parseQuietly(body) {
    try {
        const parsed = JSON.parse(body);
        return parsed !== null && typeof parsed === 'object' ? parsed : {};
    }
    catch {
        return {};
    }
}
/**
 * Прерываемая пауза: без учёта сигнала отмена замечалась бы только через
 * всю паузу целиком, до 30 секунд при значениях по умолчанию.
 */
function sleep(ms, signal) {
    if (!signal) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    if (signal.aborted) {
        return Promise.reject(new AbortError('Запрос отменён.'));
    }
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        function onAbort() {
            clearTimeout(timer);
            reject(new AbortError('Запрос отменён.'));
        }
        signal.addEventListener('abort', onAbort, { once: true });
    });
}
