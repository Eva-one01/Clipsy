import type { Lang } from '@/i18n';

export interface City {
  id: string;
  tz: string;
  /** Nombres en es, en, pt, fr, ru, de */
  names: [string, string, string, string, string, string];
}

const order: Lang[] = ['es', 'en', 'pt', 'fr', 'ru', 'de'];

/** Lista curada. La búsqueda también acepta cualquier zona IANA escrita a mano. */
export const cities: City[] = [
  { id: 'bogota', tz: 'America/Bogota', names: ['Bogotá', 'Bogotá', 'Bogotá', 'Bogota', 'Богота', 'Bogotá'] },
  { id: 'mexico', tz: 'America/Mexico_City', names: ['Ciudad de México', 'Mexico City', 'Cidade do México', 'Mexico', 'Мехико', 'Mexiko-Stadt'] },
  { id: 'lima', tz: 'America/Lima', names: ['Lima', 'Lima', 'Lima', 'Lima', 'Лима', 'Lima'] },
  { id: 'quito', tz: 'America/Guayaquil', names: ['Quito', 'Quito', 'Quito', 'Quito', 'Кито', 'Quito'] },
  { id: 'caracas', tz: 'America/Caracas', names: ['Caracas', 'Caracas', 'Caracas', 'Caracas', 'Каракас', 'Caracas'] },
  { id: 'santiago', tz: 'America/Santiago', names: ['Santiago', 'Santiago', 'Santiago', 'Santiago', 'Сантьяго', 'Santiago de Chile'] },
  { id: 'buenosaires', tz: 'America/Argentina/Buenos_Aires', names: ['Buenos Aires', 'Buenos Aires', 'Buenos Aires', 'Buenos Aires', 'Буэнос-Айрес', 'Buenos Aires'] },
  { id: 'saopaulo', tz: 'America/Sao_Paulo', names: ['São Paulo', 'São Paulo', 'São Paulo', 'São Paulo', 'Сан-Паулу', 'São Paulo'] },
  { id: 'montevideo', tz: 'America/Montevideo', names: ['Montevideo', 'Montevideo', 'Montevidéu', 'Montevideo', 'Монтевидео', 'Montevideo'] },
  { id: 'panama', tz: 'America/Panama', names: ['Panamá', 'Panama City', 'Cidade do Panamá', 'Panama', 'Панама', 'Panama-Stadt'] },
  { id: 'sanjose', tz: 'America/Costa_Rica', names: ['San José', 'San José', 'San José', 'San José', 'Сан-Хосе', 'San José'] },
  { id: 'santodomingo', tz: 'America/Santo_Domingo', names: ['Santo Domingo', 'Santo Domingo', 'Santo Domingo', 'Saint-Domingue', 'Санто-Доминго', 'Santo Domingo'] },
  { id: 'newyork', tz: 'America/New_York', names: ['Nueva York', 'New York', 'Nova York', 'New York', 'Нью-Йорк', 'New York'] },
  { id: 'miami', tz: 'America/New_York', names: ['Miami', 'Miami', 'Miami', 'Miami', 'Майами', 'Miami'] },
  { id: 'chicago', tz: 'America/Chicago', names: ['Chicago', 'Chicago', 'Chicago', 'Chicago', 'Чикаго', 'Chicago'] },
  { id: 'denver', tz: 'America/Denver', names: ['Denver', 'Denver', 'Denver', 'Denver', 'Денвер', 'Denver'] },
  { id: 'losangeles', tz: 'America/Los_Angeles', names: ['Los Ángeles', 'Los Angeles', 'Los Angeles', 'Los Angeles', 'Лос-Анджелес', 'Los Angeles'] },
  { id: 'toronto', tz: 'America/Toronto', names: ['Toronto', 'Toronto', 'Toronto', 'Toronto', 'Торонто', 'Toronto'] },
  { id: 'vancouver', tz: 'America/Vancouver', names: ['Vancouver', 'Vancouver', 'Vancouver', 'Vancouver', 'Ванкувер', 'Vancouver'] },
  { id: 'honolulu', tz: 'Pacific/Honolulu', names: ['Honolulu', 'Honolulu', 'Honolulu', 'Honolulu', 'Гонолулу', 'Honolulu'] },
  { id: 'london', tz: 'Europe/London', names: ['Londres', 'London', 'Londres', 'Londres', 'Лондон', 'London'] },
  { id: 'lisbon', tz: 'Europe/Lisbon', names: ['Lisboa', 'Lisbon', 'Lisboa', 'Lisbonne', 'Лиссабон', 'Lissabon'] },
  { id: 'madrid', tz: 'Europe/Madrid', names: ['Madrid', 'Madrid', 'Madri', 'Madrid', 'Мадрид', 'Madrid'] },
  { id: 'paris', tz: 'Europe/Paris', names: ['París', 'Paris', 'Paris', 'Paris', 'Париж', 'Paris'] },
  { id: 'berlin', tz: 'Europe/Berlin', names: ['Berlín', 'Berlin', 'Berlim', 'Berlin', 'Берлин', 'Berlin'] },
  { id: 'rome', tz: 'Europe/Rome', names: ['Roma', 'Rome', 'Roma', 'Rome', 'Рим', 'Rom'] },
  { id: 'amsterdam', tz: 'Europe/Amsterdam', names: ['Ámsterdam', 'Amsterdam', 'Amsterdã', 'Amsterdam', 'Амстердам', 'Amsterdam'] },
  { id: 'zurich', tz: 'Europe/Zurich', names: ['Zúrich', 'Zurich', 'Zurique', 'Zurich', 'Цюрих', 'Zürich'] },
  { id: 'athens', tz: 'Europe/Athens', names: ['Atenas', 'Athens', 'Atenas', 'Athènes', 'Афины', 'Athen'] },
  { id: 'istanbul', tz: 'Europe/Istanbul', names: ['Estambul', 'Istanbul', 'Istambul', 'Istanbul', 'Стамбул', 'Istanbul'] },
  { id: 'moscow', tz: 'Europe/Moscow', names: ['Moscú', 'Moscow', 'Moscou', 'Moscou', 'Москва', 'Moskau'] },
  { id: 'cairo', tz: 'Africa/Cairo', names: ['El Cairo', 'Cairo', 'Cairo', 'Le Caire', 'Каир', 'Kairo'] },
  { id: 'lagos', tz: 'Africa/Lagos', names: ['Lagos', 'Lagos', 'Lagos', 'Lagos', 'Лагос', 'Lagos'] },
  { id: 'johannesburg', tz: 'Africa/Johannesburg', names: ['Johannesburgo', 'Johannesburg', 'Joanesburgo', 'Johannesburg', 'Йоханнесбург', 'Johannesburg'] },
  { id: 'dubai', tz: 'Asia/Dubai', names: ['Dubái', 'Dubai', 'Dubai', 'Dubaï', 'Дубай', 'Dubai'] },
  { id: 'mumbai', tz: 'Asia/Kolkata', names: ['Bombay', 'Mumbai', 'Mumbai', 'Bombay', 'Мумбаи', 'Mumbai'] },
  { id: 'bangkok', tz: 'Asia/Bangkok', names: ['Bangkok', 'Bangkok', 'Bangkok', 'Bangkok', 'Бангкок', 'Bangkok'] },
  { id: 'singapore', tz: 'Asia/Singapore', names: ['Singapur', 'Singapore', 'Singapura', 'Singapour', 'Сингапур', 'Singapur'] },
  { id: 'hongkong', tz: 'Asia/Hong_Kong', names: ['Hong Kong', 'Hong Kong', 'Hong Kong', 'Hong Kong', 'Гонконг', 'Hongkong'] },
  { id: 'shanghai', tz: 'Asia/Shanghai', names: ['Shanghái', 'Shanghai', 'Xangai', 'Shanghai', 'Шанхай', 'Shanghai'] },
  { id: 'seoul', tz: 'Asia/Seoul', names: ['Seúl', 'Seoul', 'Seul', 'Séoul', 'Сеул', 'Seoul'] },
  { id: 'tokyo', tz: 'Asia/Tokyo', names: ['Tokio', 'Tokyo', 'Tóquio', 'Tokyo', 'Токио', 'Tokio'] },
  { id: 'sydney', tz: 'Australia/Sydney', names: ['Sídney', 'Sydney', 'Sydney', 'Sydney', 'Сидней', 'Sydney'] },
  { id: 'auckland', tz: 'Pacific/Auckland', names: ['Auckland', 'Auckland', 'Auckland', 'Auckland', 'Окленд', 'Auckland'] },
  { id: 'utc', tz: 'UTC', names: ['UTC', 'UTC', 'UTC', 'UTC', 'UTC', 'UTC'] },
];

export function cityName(c: City, lang: Lang): string {
  return c.names[order.indexOf(lang)] ?? c.names[1];
}

export function findCity(id?: string | null): City | undefined {
  return id ? cities.find((c) => c.id === id) : undefined;
}

export function cityForTz(tz: string): City | undefined {
  return cities.find((c) => c.tz === tz);
}

/** Nombre a mostrar para un reloj guardado, en el idioma actual. */
export function clockLabel(clock: { city: string; cityId?: string }, lang: Lang): string {
  const c = findCity(clock.cityId);
  return c ? cityName(c, lang) : clock.city;
}
