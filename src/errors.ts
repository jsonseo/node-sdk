/** Общий предок всех ошибок SDK. */
export class JsonSeoError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;

    // Иначе instanceof ломается в сборках под ES5.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Сервис ответил отказом. Тело сохраняется целиком. */
export class JsonSeoApiError extends JsonSeoError {
  /** HTTP-статус ответа. */
  readonly status: number;

  /** Тело ответа как есть. */
  readonly body: string;

  /** Разобранный JSON ответа. Пустой объект, если тело не разобралось. */
  readonly payload: Record<string, unknown>;

  /** Через сколько секунд вернуться. null, если срок не назван. */
  readonly retryAfter: number | null;

  constructor(
    message: string,
    status: number,
    body: string,
    payload: Record<string, unknown>,
    retryAfter: number | null = null,
  ) {
    super(message);
    this.status = status;
    this.body = body;
    this.payload = payload;
    this.retryAfter = retryAfter;
  }
}

/** 402: на счёте не хватает средств. */
export class PaymentRequiredError extends JsonSeoApiError {}

/** 403 или 401: ключ не передан или недействителен. */
export class UnauthorizedError extends JsonSeoApiError {}

/** 503: выдачу получить не вышло. Деньги не списаны, повтор обычно проходит. */
export class ServiceUnavailableError extends JsonSeoApiError {}

/** 422: параметры запроса не приняты. Деньги не списываются. */
export class ValidationError extends JsonSeoApiError {
  /** Ошибки по именам параметров: `{ text: ['Введите запрос'] }`. */
  get errors(): Record<string, string[]> {
    const raw = this.payload.errors;

    if (raw === null || typeof raw !== 'object') {
      return {};
    }

    const errors: Record<string, string[]> = {};

    for (const [field, messages] of Object.entries(raw as Record<string, unknown>)) {
      errors[field] = Array.isArray(messages) ? messages.map(String) : [String(messages)];
    }

    return errors;
  }

  /** Забракованные параметры. */
  get fields(): string[] {
    return Object.keys(this.errors);
  }
}

/** 429: превышен лимит частоты. Срок повтора — в `retryAfter`. */
export class RateLimitError extends JsonSeoApiError {}

/** До сервиса не достучались: сеть, DNS, TLS. Статуса нет. */
export class NetworkError extends JsonSeoError {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
  }
}

/** Запрос не уложился в отведённое время и был прерван на стороне клиента. */
export class TimeoutError extends NetworkError {}

/**
 * Заголовки пришли, а тело дочитать не вышло. Автоматически не повторяется:
 * выдача уже собрана и оплачена, обрыв случился на отдаче.
 */
export class IncompleteResponseError extends NetworkError {}

/** Запрос прерван переданным в него AbortSignal. */
export class AbortError extends JsonSeoError {}

/** Запрос не отправлен: SDK забраковал аргументы ещё до обращения к сети. */
export class InvalidArgumentError extends JsonSeoError {}

/**
 * Успех, но тело не разобралось как JSON. Тело сохраняется: страница уже
 * оплачена, и достать из неё данные руками лучше, чем не иметь ничего.
 */
export class ParseError extends JsonSeoError {
  /** Тело ответа как есть. */
  readonly body: string;

  constructor(message: string, body: string) {
    super(message);
    this.body = body;
  }
}

/**
 * Собирает ошибку под этот HTTP-статус.
 *
 * @internal
 */
export function apiErrorFor(
  status: number,
  body: string,
  payload: Record<string, unknown>,
  retryAfter: number | null,
): JsonSeoApiError {
  const message =
    typeof payload.message === 'string' && payload.message !== ''
      ? payload.message
      : `JSON SEO API вернул ошибку ${status}.`;

  switch (status) {
    case 401:
    case 403:
      return new UnauthorizedError(message, status, body, payload, retryAfter);
    case 402:
      return new PaymentRequiredError(message, status, body, payload, retryAfter);
    case 422:
      return new ValidationError(message, status, body, payload, retryAfter);
    case 429:
      return new RateLimitError(message, status, body, payload, retryAfter);
    case 503:
      return new ServiceUnavailableError(message, status, body, payload, retryAfter);
    default:
      return new JsonSeoApiError(message, status, body, payload, retryAfter);
  }
}
