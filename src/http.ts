import type { ParamValue } from './common.js';
import {
  AbortError,
  apiErrorFor,
  IncompleteResponseError,
  InvalidArgumentError,
  JsonSeoError,
  NetworkError,
  ParseError,
  TimeoutError,
} from './errors.js';

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
} satisfies Record<keyof ClientOptions, true>;

const KNOWN_OPTION_NAMES = Object.keys(KNOWN_OPTIONS);
const VERSION = '1.0.2';

/**
 * Транспорт: собирает запрос, разбирает ответ и решает, повторять ли отказ.
 *
 * @internal
 */
export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly attempts: number;
  private readonly retryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly auth: AuthMode;
  private readonly userAgent: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: ClientOptions) {
    // Обрезаем ровно тот же набор, что и остальные SDK: родной trim в
    // каждом языке свой, и один ключ принимался бы по-разному.
    const apiKey = typeof options.apiKey === 'string' ? options.apiKey.replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, '') : '';

    if (apiKey === '') {
      throw new InvalidArgumentError('Нужен API-ключ: возьмите его в личном кабинете на https://jsonseo.ru.');
    }

    // Заголовок Authorization не переносит не-ASCII и управляющие символы:
    // с таким ключом он не соберётся, и сервис ответит «токен не
    // предоставлен» вместо внятной ошибки.
    if (/[^\x20-\x7E]/.test(apiKey)) {
      throw new InvalidArgumentError(
        'API-ключ содержит символы вне ASCII: проверьте, что он скопирован целиком и без лишних знаков.',
      );
    }

    // undefined из спреда частичного конфига — не настройка, а её отсутствие.
    const unknown = Object.keys(options).filter(
      (name) => !KNOWN_OPTION_NAMES.includes(name) && options[name as keyof ClientOptions] !== undefined,
    );

    if (unknown.length > 0) {
      throw new InvalidArgumentError(
        `Неизвестные настройки клиента: ${unknown.join(', ')}. Доступны: ${KNOWN_OPTION_NAMES.join(', ')}.`,
      );
    }

    // NaN сюда приезжает из Number(process.env.ЧЕГО_НЕТ), и без проверки
    // сравнение с ним всегда ложно — повторы платного запроса не кончались бы.
    if (options.attempts !== undefined && (!Number.isInteger(options.attempts) || options.attempts < 1)) {
      throw new InvalidArgumentError(
        `Настройка attempts ожидает целое число не меньше 1, получено: ${String(options.attempts)}.`,
      );
    }

    if (options.auth !== undefined && options.auth !== 'header' && options.auth !== 'query') {
      throw new InvalidArgumentError(`Настройка auth принимает "header" или "query", получено: ${String(options.auth)}.`);
    }

    const fetchImpl = options.fetch ?? (typeof fetch === 'function' ? (fetch as FetchLike) : undefined);

    if (!fetchImpl) {
      throw new InvalidArgumentError(
        'В этой среде нет глобального fetch. Нужен Node 18+, Bun или Deno — либо передайте свою реализацию настройкой fetch.',
      );
    }

    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 300_000;
    this.attempts = options.attempts ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1_000;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 30_000;
    this.auth = options.auth ?? 'header';
    this.userAgent = options.userAgent ?? `jsonseo-node/${VERSION}`;
    this.fetchImpl = fetchImpl;
  }

  /** Запрос, ответ которого разбирается как JSON. */
  async json<T>(path: string, params: Record<string, ParamValue>, options?: RequestOptions): Promise<T> {
    const body = await this.send(path, params, 'application/json', options);

    try {
      return JSON.parse(body) as T;
    } catch (error) {
      // Тело кладём в ошибку: страница выдачи уже оплачена.
      throw new ParseError(`Ответ JSON SEO API не разобрался как JSON: ${(error as Error).message}.`, body);
    }
  }

  /** Запрос, ответ которого возвращается строкой без разбора. */
  text(path: string, params: Record<string, ParamValue>, options?: RequestOptions): Promise<string> {
    return this.send(path, params, 'application/xml, text/xml', options);
  }

  /**
   * Выполняет запрос, повторяя те отказы, за которые сервис не берёт денег:
   * 429, 5xx и обрывы связи до того, как ответ начал приходить.
   */
  private async send(
    path: string,
    params: Record<string, ParamValue>,
    accept: string,
    options?: RequestOptions,
  ): Promise<string> {
    const query = encodeParams(params);

    if (this.auth === 'query') {
      query.set('key', this.apiKey);
    }

    const headers: Record<string, string> = {
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

    for (let attempt = 0; ; attempt++) {
      let response: { status: number; ok: boolean; retryAfter: number | null; body: string };

      try {
        response = await this.fetchOnce(url, headers, body, options);
      } catch (error) {
        // Таймаут и обрыв на середине тела не повторяем: выдача уже
        // собрана и оплачена.
        if (
          error instanceof NetworkError &&
          !(error instanceof TimeoutError) &&
          !(error instanceof IncompleteResponseError) &&
          !this.isLastAttempt(attempt)
        ) {
          try {
            await sleep(this.backoff(attempt), options?.signal);
          } catch (aborted) {
            // Отменили во время паузы: причину ожидания не теряем.
            (aborted as { cause?: unknown }).cause = error;

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
      if (
        this.isLastAttempt(attempt) ||
        !isRetryable(response.status) ||
        (retryAfter !== null && retryAfter * 1000 > this.maxRetryDelayMs)
      ) {
        throw error;
      }

      // Не раньше, чем просит сервис, и не чаще своего бэкоффа:
      // Retry-After прошедшей датой даёт ноль.
      const pause =
        retryAfter === null ? this.backoff(attempt) : Math.max(retryAfter * 1000, this.backoff(attempt));

      await sleep(pause, options?.signal);
    }
  }

  /**
   * Один заход в сеть: таймаут и внешняя отмена сводятся в один сигнал.
   * Тело читается здесь же — fetch отдаёт ответ сразу по заголовкам, и
   * снаружи застрявшая передача висела бы без ограничения по времени.
   */
  private async fetchOnce(
    url: string,
    headers: Record<string, string>,
    body: string,
    options?: RequestOptions,
  ): Promise<{ status: number; ok: boolean; retryAfter: number | null; body: string }> {
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

      let text: string;

      try {
        text = await response.text();
      } catch (error) {
        if (timedOut) {
          throw new TimeoutError(`Ответа от JSON SEO API не дождались за ${timeoutMs} мс.`, error);
        }

        if (external?.aborted) {
          throw new AbortError('Запрос отменён.');
        }

        // Тело дочитать не вышло, а выдача уже оплачена — отдельный
        // класс ошибки, повторять такое нельзя.
        throw new IncompleteResponseError(
          `Ответ от JSON SEO API пришёл не целиком: ${(error as Error).message}.`,
          error,
        );
      }

      return {
        status: response.status,
        ok: response.ok,
        retryAfter: parseRetryAfter(response.headers.get('retry-after')),
        body: text,
      };
    } catch (error) {
      if (error instanceof JsonSeoError) {
        throw error;
      }

      if (timedOut) {
        throw new TimeoutError(`Ответа от JSON SEO API не дождались за ${timeoutMs} мс.`, error);
      }

      if (external?.aborted) {
        throw new AbortError('Запрос отменён.');
      }

      throw new NetworkError(`Запрос к JSON SEO API не удался: ${(error as Error).message}.`, error);
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', forward);
    }
  }

  /** Попытки нумеруются с нуля: при attempts = 3 последняя — вторая. */
  private isLastAttempt(attempt: number): boolean {
    return attempt + 1 >= this.attempts;
  }

  /**
   * Пауза удваивается с каждой попыткой; случайная добавка разводит
   * параллельные запросы, чтобы они не вернулись разом.
   */
  private backoff(attempt: number): number {
    const delay = this.retryDelayMs * 2 ** attempt;

    // Потолок накладывается после добавки, иначе она бы его превышала.
    return Math.min(delay + delay * 0.25 * Math.random(), this.maxRetryDelayMs);
  }
}

/** Приводит параметры к тому виду, в каком их ждёт форма запроса. */
export function encodeParams(params: Record<string, ParamValue>): URLSearchParams {
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
      query.set(
        name,
        value.map((item, index) => scalar(`${name}[${index}]`, item)).join(name === 'phrases' ? '\n' : ','),
      );

      continue;
    }

    query.set(name, scalar(name, value as string | number | boolean));
  }

  return query;
}

function scalar(name: string, value: string | number | boolean): string {
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

  throw new InvalidArgumentError(
    `Параметр ${name} должен быть строкой, числом, флагом или массивом таких значений.`,
  );
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Сколько секунд просит подождать сервис. RFC 9110 разрешает число секунд
 * и HTTP-дату, разбираются обе.
 */
function parseRetryAfter(header: string | null): number | null {
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
function parseQuietly(body: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(body);

    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Прерываемая пауза: без учёта сигнала отмена замечалась бы только через
 * всю паузу целиком, до 30 секунд при значениях по умолчанию.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
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

    function onAbort(): void {
      clearTimeout(timer);
      reject(new AbortError('Запрос отменён.'));
    }

    signal.addEventListener('abort', onAbort, { once: true });
  });
}
