/**
 * Значение, которое можно передать параметром метода. Массив склеивается
 * запятой (а список фраз — переводом строки), флаг превращается в 1 или 0,
 * null и undefined не отправляются вовсе.
 */
export type ParamValue = string | number | boolean | ReadonlyArray<string | number> | null | undefined;

/** Параметр-переключатель: API принимает и 1/0, и true/false. */
export type Flag = boolean | 0 | 1;

/** Устройство, с которого снимается выдача. */
export type Device = 'mobile' | 'desktop' | 'tablet';

/** У Google и Bing планшетной выдачи нет. */
export type MobileDevice = 'mobile' | 'desktop';

/** Фильтрация взрослого контента у Яндекса. */
export type AdultFilter = 'none' | 'moderate' | 'strict';

/** Она же у Bing — значения называются иначе. */
export type BingSafeSearch = 'off' | 'moderate' | 'strict';

/** SafeSearch Google. */
export type GoogleSafeSearch = 'active' | 'off';

/** Доменная зона Яндекса. */
export type YandexZone = 'ru' | 'tr' | 'com' | 'kz' | 'by' | 'be' | 'kk' | 'uz' | 'com.tr';

/** Язык названий в справочниках регионов. */
export type RegionLanguage = 'ru' | 'en';

/** Размер картинки. У Google меньшая ступень — это значки ровно 256 px. */
export type ImageSize = 'large' | 'medium' | 'small';

/** Ориентация картинки. Есть у всех трёх поисковиков. */
export type ImageOrientation = 'horizontal' | 'vertical' | 'square';

/** Цвет картинки: color — полноцветные, mono — чёрно-белые, остальное — преобладающий. */
export type ImageColor =
  | 'color'
  | 'mono'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'blue'
  | 'purple'
  | 'white'
  | 'black'
  | 'pink'
  | 'brown';

/** Тип изображения. transparent нет у Яндекса, demotivator есть только у него. */
export type ImageType = 'photo' | 'clipart' | 'lineart' | 'face' | 'animated' | 'transparent' | 'demotivator';

/** Формат файла. У Bing поддерживается только gif. */
export type ImageFormat = 'jpg' | 'png' | 'gif';

/** Насколько свежий результат. Окна у поисковиков свои. */
export type Freshness = 'day' | 'week' | 'month' | 'year';

/** Длительность ролика. Границы ступеней у каждого поисковика свои. */
export type VideoDuration = 'short' | 'medium' | 'long';

/**
 * Вид частотности Вордстата. Операторы расставляются на стороне сервиса —
 * фразу передавайте без кавычек.
 */
export type WordstatKind = 'base' | 'phrase' | 'exact' | 'superexact';

/** Шаг динамики: month и week — история с 2018 года, day — последние 60 дней. */
export type WordstatGraphType = 'day' | 'week' | 'month';

/** Разрез географии показов. */
export type WordstatMapType = 'all' | 'regions' | 'cities';

/** Период прогноза Яндекс Директа. */
export type DirectPeriod = 'week' | 'month' | 'quarter' | 'year';
