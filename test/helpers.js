/** Заглушка fetch: отдаёт сложенные ответы и запоминает, что просили. */
export function fakeFetch() {
  const queue = [];

  const impl = async (url, init) => {
    impl.calls.push({
      url,
      method: init.method,
      headers: init.headers,
      body: init.body,
      params: new URLSearchParams(init.body),
      signal: init.signal,
    });

    if (queue.length === 0) {
      throw new Error('В очереди заглушки не осталось ответов, а запрос пришёл.');
    }

    const next = queue.shift();

    if (next instanceof Error) {
      throw next;
    }

    if (next === null) {
      // Зависший запрос: ответим, только когда клиент оборвёт соединение.
      return new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('The operation was aborted')), { once: true });
      });
    }

    return next;
  };

  impl.calls = [];

  impl.json = (body, status = 200, headers = {}) => {
    queue.push(new Response(JSON.stringify(body), { status, headers }));

    return impl;
  };

  impl.raw = (body, status = 200, headers = {}) => {
    queue.push(new Response(body, { status, headers }));

    return impl;
  };

  impl.fail = (message = 'сеть недоступна') => {
    queue.push(new TypeError(message));

    return impl;
  };

  /** Заголовки пришли, а тело читать нечем: обрыв на отдаче. */
  impl.cut = () => {
    queue.push(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new TypeError('соединение оборвано на середине тела'));
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    return impl;
  };

  /** Никогда не отвечает: для проверки таймаута. */
  impl.hang = () => {
    queue.push(null);

    return impl;
  };

  return impl;
}
