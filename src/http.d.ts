import type { ParamValue } from './common.js';
/** Глобальный `fetch` или любая его замена. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
/** Куда класть ключ: в заголовок Authorization или в параметр key. */
export type AuthMode = 'header' | 'query';
/** Настройки клиента. */
export interface ClientOptions {
    /** Ключ из личного кабинета на jsonseo.ru. */
    apiKey: string;
    /** Адрес API. По умолчанию https://jsonseo.ru/api */
    baseUrl?: string;
    /** Сколько ждать ответа на одну попытку. По умолчанию 300 000 мс. */
    timeoutMs?: number;
    /** Сколько всего попыток у запроса, включая первую. По умолчанию 3. */
    attempts?: number;
    /** Стартовая пауза между попытками, миллисекунд. По умолчанию 1000. */
    retryDelayMs?: number;
    /**
     * Потолок паузы между попытками, миллисекунд. По умолчанию 30 000. Если
     * сервис просит ждать дольше, повторов не будет вовсе.
     */
    maxRetryDelayMs?: number;
    /** Где передавать ключ. В заголовке — чтобы не оседал в логах прокси. */
    auth?: AuthMode;
    /** Своя подпись клиента. */
    userAgent?: string;
    /** Своя реализация fetch — для тестов или прокси. */
    fetch?: FetchLike;
}
/** Настройки одного запроса. */
export interface RequestOptions {
    /** Отмена запроса снаружи. */
    signal?: AbortSignal;
    /** Таймаут именно этого запроса, миллисекунд. */
    timeoutMs?: number;
}
/**
 * Транспорт: собирает запрос, разбирает ответ и решает, повторять ли отказ.
 *
 * @internal
 */
export declare class HttpClient {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeoutMs;
    private readonly attempts;
    private readonly retryDelayMs;
    private readonly maxRetryDelayMs;
    private readonly auth;
    private readonly userAgent;
    private readonly fetchImpl;
    constructor(options: ClientOptions);
    /** Запрос, ответ которого разбирается как JSON. */
    json<T>(path: string, params: Record<string, ParamValue>, options?: RequestOptions): Promise<T>;
    /** Запрос, ответ которого возвращается строкой без разбора. */
    text(path: string, params: Record<string, ParamValue>, options?: RequestOptions): Promise<string>;
    /**
     * Выполняет запрос, повторяя те отказы, за которые сервис не берёт денег:
     * 429, 5xx и обрывы связи до того, как ответ начал приходить.
     */
    private send;
    /**
     * Один заход в сеть: таймаут и внешняя отмена сводятся в один сигнал.
     * Тело читается здесь же — fetch отдаёт ответ сразу по заголовкам, и
     * снаружи застрявшая передача висела бы без ограничения по времени.
     */
    private fetchOnce;
    /** Попытки нумеруются с нуля: при attempts = 3 последняя — вторая. */
    private isLastAttempt;
    /**
     * Пауза удваивается с каждой попыткой; случайная добавка разводит
     * параллельные запросы, чтобы они не вернулись разом.
     */
    private backoff;
}
/** Приводит параметры к тому виду, в каком их ждёт форма запроса. */
export declare function encodeParams(params: Record<string, ParamValue>): URLSearchParams;
