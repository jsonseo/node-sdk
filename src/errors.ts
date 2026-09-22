/**
 * Общий предок всех ошибок SDK: ловите его, если разбирать причину не
 * нужно, — ни одна ошибка библиотеки мимо него не пройдёт.
 */
export class JsonSeoError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;

    // Без этого instanceof ломается в сборках под ES5: цепочка прототипов
    // после наследования от Error там восстанавливается вручную.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Сервис ответил, но отказом. Сообщение берётся из поля message ответа,
 * тело сохраняется целиком — в нём бывают подробности, которых нет в тексте.
 */
export class JsonSeoApiError extends JsonSeoError {
  /** HTTP-статус ответа. */
  readonly status: number;

  /** Тело ответа как есть. */
  readonly body: string;

  /** Разобранный JSON ответа. Пустой объект, если тело не разобралось. */
  readonly payload: Record<string, unknown>;

  /**
   * Через сколько секунд сервис разрешает вернуться. null, если срок не
   * назван. Заголовок приходит не только с 429: им сопровождается и 503.
   */
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

/** 402: на счёте не хватает средств. Повторять запрос бессмысленно. */
export class PaymentRequiredError extends JsonSeoApiError {}

/** 403: ключ не передан или недействителен. */
export class UnauthorizedError extends JsonSeoApiError {}

/** 503: выдачу получить не вышло. Деньги не списываются, повтор обычно проходит. */
export class ServiceUnavailableError extends JsonSeoApiError {}

/** 422: параметры запроса не приняты. Деньги не списываются. */
export class ValidationError extends JsonSeoApiError {
  /**
   * Ошибки по именам параметров: `{ text: ['Введите запрос'] }`.
   * Пустой объект, если сервис прислал только общее сообщение.
   */
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

  /** Имена параметров, которые сервис забраковал. */
  get fields(): string[] {
    return Object.keys(this.errors);
  }
}

/**
 * 429: превышен один из лимитов частоты. Деньги не списываются, запрос
 * можно повторить — через сколько, сказано в поле `retryAfter`.
 */
export class RateLimitError extends JsonSeoApiError {}

/**
 * До сервиса не достучались: сеть, DNS, TLS, оборванное соединение.
 * Ответа нет, поэтому и статуса нет — отличается этим от JsonSeoApiError.
 */
export class NetworkError extends JsonSeoError {
  constructor(message: string, cause?: unknown) {
    // Исходная ошибка fetch остаётся в штатном поле cause.
    super(message, { cause });
  }
}

/** Запрос не уложился в отведённое время и был прерван на стороне клиента. */
export class TimeoutError extends NetworkError {}

/**
 * Соединение оборвалось посреди тела: заголовки пришли, а ответ дочитать
 * не вышло.
 *
 * Такой запрос не повторяется автоматически: сервис успел собрать выдачу и
 * списать за неё деньги — обрыв случился уже на отдаче, и второй заход стоил
 * бы ещё раз. Повторять или нет, решает вызывающий.
 */
export class IncompleteResponseError extends NetworkError {}

/** Запрос прерван переданным в него AbortSignal. */
export class AbortError extends JsonSeoError {}

/** Запрос не отправлен: SDK забраковал аргументы ещё до обращения к сети. */
export class InvalidArgumentError extends JsonSeoError {}

/**
 * Сервис ответил успехом, но тело не разобралось как JSON — так выглядит
 * подменённый прокси ответ. Тело сохраняется целиком: страница выдачи уже
 * оплачена, и вытащить из неё данные руками лучше, чем не иметь ничего.
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
 * Собирает ошибку того класса, который отвечает за этот HTTP-статус.
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
