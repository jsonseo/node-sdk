/**
 * Позиции сайта в Яндексе по списку запросов.
 *
 * Запуск: JSONSEO_KEY=ваш_ключ npx tsx examples/positions.ts
 */

import { JsonSeoClient, JsonSeoError } from 'jsonseo';

const client = new JsonSeoClient(process.env.JSONSEO_KEY!);

const domain = 'example.com';
const queries = ['купить ноутбук', 'ноутбук недорого'];

for (const query of queries) {
  try {
    // break_domain останавливает поиск: платить за страницы ниже незачем.
    const serp = await client.yandex({
      text: query,
      region: 213,
      pages: 10,
      break_domain: domain,
    });

    // Сравнивать домены напрямую нельзя: выдача отдаёт их с поддоменом,
    // и example.com не совпал бы с www.example.com.
    const position = serp.results.findIndex((result) => {
      const found = result.domain.toLowerCase();

      return found === domain || found.endsWith(`.${domain}`);
    });

    console.log(`${query}: ${position === -1 ? `не найден в топ-${serp.results.length}` : position + 1}`);
  } catch (error) {
    if (error instanceof JsonSeoError) {
      console.error(`${query}: ошибка — ${error.message}`);
    } else {
      throw error;
    }
  }
}
