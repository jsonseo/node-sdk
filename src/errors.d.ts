/** Общий предок всех ошибок SDK. */
export declare class JsonSeoError extends Error {
    constructor(message: string, options?: {
        cause?: unknown;
    });
}
/** Сервис ответил отказом. Тело сохраняется целиком. */
export declare class JsonSeoApiError extends JsonSeoError {
    /** HTTP-статус ответа. */
    readonly status: number;
    /** Тело ответа как есть. */
    readonly body: string;
    /** Разобранный JSON ответа. Пустой объект, если тело не разобралось. */
    readonly payload: Record<string, unknown>;
    /** Через сколько секунд вернуться. null, если срок не назван. */
    readonly retryAfter: number | null;
    constructor(message: string, status: number, body: string, payload: Record<string, unknown>, retryAfter?: number | null);
}
/** 402: на счёте не хватает средств. */
export declare class PaymentRequiredError extends JsonSeoApiError {
}
/** 403 или 401: ключ не передан или недействителен. */
export declare class UnauthorizedError extends JsonSeoApiError {
}
/** 503: выдачу получить не вышло. Деньги не списаны, повтор обычно проходит. */
export declare class ServiceUnavailableError extends JsonSeoApiError {
}
/** 422: параметры запроса не приняты. Деньги не списываются. */
export declare class ValidationError extends JsonSeoApiError {
    /** Ошибки по именам параметров: `{ text: ['Введите запрос'] }`. */
    get errors(): Record<string, string[]>;
    /** Забракованные параметры. */
    get fields(): string[];
}
/** 429: превышен лимит частоты. Срок повтора — в `retryAfter`. */
export declare class RateLimitError extends JsonSeoApiError {
}
/** До сервиса не достучались: сеть, DNS, TLS. Статуса нет. */
export declare class NetworkError extends JsonSeoError {
    constructor(message: string, cause?: unknown);
}
/** Запрос не уложился в отведённое время и был прерван на стороне клиента. */
export declare class TimeoutError extends NetworkError {
}
/**
 * Заголовки пришли, а тело дочитать не вышло. Автоматически не повторяется:
 * выдача уже собрана и оплачена, обрыв случился на отдаче.
 */
export declare class IncompleteResponseError extends NetworkError {
}
/** Запрос прерван переданным в него AbortSignal. */
export declare class AbortError extends JsonSeoError {
}
/** Запрос не отправлен: SDK забраковал аргументы ещё до обращения к сети. */
export declare class InvalidArgumentError extends JsonSeoError {
}
/**
 * Успех, но тело не разобралось как JSON. Тело сохраняется: страница уже
 * оплачена, и достать из неё данные руками лучше, чем не иметь ничего.
 */
export declare class ParseError extends JsonSeoError {
    /** Тело ответа как есть. */
    readonly body: string;
    constructor(message: string, body: string);
}
/**
 * Собирает ошибку под этот HTTP-статус.
 *
 * @internal
 */
export declare function apiErrorFor(status: number, body: string, payload: Record<string, unknown>, retryAfter: number | null): JsonSeoApiError;
