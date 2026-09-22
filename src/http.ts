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

/** Подходит и глобальный `fetch`, и любая его замена с той же сигнатурой. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Куда класть ключ: в заголовок Authorization или в параметр key. */
export type AuthMode = 'header' | 'query';

/** Настройки клиента. */
export interface ClientOptions {
  /** Ключ из личного кабинета на jsonseo.ru. */
  apiKey: string;
  /** Адрес API. По умолчанию https://jsonseo.ru/api */
  baseUrl?: string;
  /**
   * Сколько ждать ответа, миллисекунд. По умолчанию 300 000: многостраничный
   * запрос выдачи собирается минутами, и обрыв на стороне клиента не отменяет
   * запрос на стороне сервиса.
   */
  timeoutMs?: number;
  /** Сколько раз повторять временный отказ. По умолчанию 2. */
  retries?: number;
  /** Стартовая пауза между попытками, миллисекунд. По умолчанию 1000. */
  retryDelayMs?: number;
  /** Потолок паузы между попытками, миллисекунд. По умолчанию 30 000. */
  maxRetryDelayMs?: number;
  /**
   * Где передавать ключ. По умолчанию в заголовке: в параметре запроса он
   * оседает в логах прокси и серверов.
   */
  auth?: AuthMode;
  /** Своя подпись клиента. */
  userAgent?: string;
  /** Своя реализация fetch — для тестов, прокси или старых версий Node. */
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
const VERSION = '1.0.0';

/**
 * Транспорт SDK: собирает запрос, разбирает ответ и решает, стоит ли
 * повторять отказ. Методов API не знает — ими занимается JsonSeoClient.
 *
 * @internal
 */
export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly retryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly auth: AuthMode;
  private readonly userAgent: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: ClientOptions) {
    if (typeof options.apiKey !== 'string' || options.apiKey.trim() === '') {
      throw new InvalidArgumentError('Нужен API-ключ: возьмите его в личном кабинете на https://jsonseo.ru.');
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

    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 300_000;
    this.retries = Math.max(0, options.retries ?? 2);
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
      // Тело кладётся в ошибку целиком: страница выдачи уже оплачена, и
      // выбросить единственный её экземпляр только потому, что прокси
      // подменил ответ, — самое дорогое, что тут можно сделать.
      throw new ParseError(`Ответ JSON SEO API не разобрался как JSON: ${(error as Error).message}.`, body);
    }
  }

  /** Запрос, ответ которого возвращается строкой без разбора. */
  text(path: string, params: Record<string, ParamValue>, options?: RequestOptions): Promise<string> {
    return this.send(path, params, 'application/xml, text/xml', options);
  }

  /**
   * Выполняет запрос и повторяет его, если отказ временный.
   *
   * Повторяются только те отказы, за которые сервис не берёт денег: 429, 5xx
   * и обрывы связи. Отказы по ключу, балансу и параметрам не повторяются —
   * сами они не изменятся. Не повторяется и таймаут: сервис продолжает
   * считать уже оплаченный запрос, и второй заход стоил бы ещё раз.
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

    // Всегда POST: длинные списки фраз в адресной строке не помещаются, а
    // сервис принимает оба способа одинаково.
    const url = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
    const body = query.toString();

    for (let attempt = 0; ; attempt++) {
      let response: { status: number; ok: boolean; retryAfter: number | null; body: string };

      try {
        response = await this.fetchOnce(url, headers, body, options);
      } catch (error) {
        // Повторяем только те обрывы, при которых запрос до сервиса не дошёл:
        // таймаут и оборвавшееся на середине тело означают, что выдача уже
        // собрана и оплачена, и второй заход стоил бы ещё раз.
        if (
          error instanceof NetworkError &&
          !(error instanceof TimeoutError) &&
          !(error instanceof IncompleteResponseError) &&
          attempt < this.retries
        ) {
          try {
            await sleep(this.backoff(attempt), options?.signal);
          } catch (aborted) {
            // Отменили во время паузы. Сама отмена важнее, но причина, по
            // которой мы вообще ждали, из диагностики пропадать не должна.
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

      // Названный сервисом срок обрезать своим потолком нельзя: проснувшись
      // раньше, мы гарантированно получим тот же отказ и сожжём попытку
      // впустую. Ждать дольше потолка тоже не станем — отдаём ошибку,
      // в ней есть retryAfter, и вызывающий решит сам.
      if (
        attempt >= this.retries ||
        !isRetryable(response.status) ||
        (retryAfter !== null && retryAfter * 1000 > this.maxRetryDelayMs)
      ) {
        throw error;
      }

      // Не раньше, чем просит сервис, и не чаще собственного бэкоффа:
      // Retry-After в форме прошедшей даты даёт ноль, и без нижней границы
      // повторы пошли бы вплотную друг за другом.
      const pause =
        retryAfter === null ? this.backoff(attempt) : Math.max(retryAfter * 1000, this.backoff(attempt));

      await sleep(pause, options?.signal);
    }
  }

  /**
   * Один заход в сеть: таймаут и внешняя отмена сводятся к одному сигналу.
   *
   * Тело читается здесь же, под тем же таймером. Снаружи его читать нельзя:
   * fetch отдаёт ответ, как только пришли заголовки, и застрявшая на середине
   * передача висела бы уже без всякого ограничения по времени.
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

        // Заголовки пришли, а тело дочитать не вышло. Выдача на стороне
        // сервиса уже собрана и оплачена, поэтому это отдельный класс
        // ошибки: повторять такой запрос — значит заплатить второй раз.
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

  /**
   * Пауза удваивается с каждой попыткой и разбавляется случайной добавкой:
   * без неё пачка параллельных запросов вернулась бы одновременно и снова
   * упёрлась бы в тот же лимит.
   */
  private backoff(attempt: number): number {
    const delay = Math.min(this.retryDelayMs * 2 ** attempt, this.maxRetryDelayMs);

    return delay + delay * 0.25 * Math.random();
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
      // Пустой список — это «параметр не задан», а не «задан пустой
      // строкой»: сервис от region= отказал бы валидацией.
      if (value.length === 0) {
        continue;
      }

      // Списки фраз склеиваются переводом строки: в самой фразе запятая
      // встречается, перевод строки — нет.
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
 * Сколько секунд просит подождать сервис.
 *
 * RFC 9110 разрешает две формы: число секунд и HTTP-дату. Разбираются обе —
 * иначе на дате retryAfter оказывался бы пустым, хотя срок назван.
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

/**
 * Тело ошибки может оказаться и не JSON — страницей от прокси, например.
 * Тогда подробностей просто нет, и это не повод терять сам статус.
 */
function parseQuietly(body: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(body);

    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Пауза между попытками, которую можно прервать.
 *
 * Без учёта сигнала отмена замечалась бы только на следующем витке цикла, то
 * есть через всю паузу целиком — до 30 секунд при значениях по умолчанию.
 * Всё это время невыгруженный таймер ещё и держал бы процесс живым.
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
