import type { Lang } from '@/i18n';

export interface City {
  id: string;
  tz: string;
  /** Nombres en es, en, pt, fr, ru, de */
  names: [string, string, string, string, string, string];
  /** Coordenadas aproximadas (para el clima de «Hoy» si se elige la ciudad). */
  lat?: number;
  lon?: number;
}

const order: Lang[] = ['es', 'en', 'pt', 'fr', 'ru', 'de'];

/** Lista curada. La búsqueda también acepta cualquier zona IANA escrita a mano. */
export const cities: City[] = [
  { id: 'bogota', tz: 'America/Bogota', names: ['Bogotá', 'Bogotá', 'Bogotá', 'Bogota', 'Богота', 'Bogotá'], lat: 4.71, lon: -74.07 },
  { id: 'mexico', tz: 'America/Mexico_City', names: ['Ciudad de México', 'Mexico City', 'Cidade do México', 'Mexico', 'Мехико', 'Mexiko-Stadt'], lat: 19.43, lon: -99.13 },
  { id: 'tijuana', tz: 'America/Tijuana', names: ['Tijuana', 'Tijuana', 'Tijuana', 'Tijuana', 'Тихуана', 'Tijuana'], lat: 32.51, lon: -117.04 },
  { id: 'guadalajara', tz: 'America/Mexico_City', names: ['Guadalajara', 'Guadalajara', 'Guadalajara', 'Guadalajara', 'Гвадалахара', 'Guadalajara'], lat: 20.67, lon: -103.35 },
  { id: 'monterrey', tz: 'America/Monterrey', names: ['Monterrey', 'Monterrey', 'Monterrey', 'Monterrey', 'Монтеррей', 'Monterrey'], lat: 25.69, lon: -100.32 },
  { id: 'medellin', tz: 'America/Bogota', names: ['Medellín', 'Medellín', 'Medellín', 'Medellín', 'Медельин', 'Medellín'], lat: 6.24, lon: -75.58 },
  { id: 'lima', tz: 'America/Lima', names: ['Lima', 'Lima', 'Lima', 'Lima', 'Лима', 'Lima'], lat: -12.05, lon: -77.04 },
  { id: 'quito', tz: 'America/Guayaquil', names: ['Quito', 'Quito', 'Quito', 'Quito', 'Кито', 'Quito'], lat: -0.18, lon: -78.47 },
  { id: 'caracas', tz: 'America/Caracas', names: ['Caracas', 'Caracas', 'Caracas', 'Caracas', 'Каракас', 'Caracas'], lat: 10.49, lon: -66.88 },
  { id: 'santiago', tz: 'America/Santiago', names: ['Santiago', 'Santiago', 'Santiago', 'Santiago', 'Сантьяго', 'Santiago de Chile'], lat: -33.45, lon: -70.67 },
  { id: 'buenosaires', tz: 'America/Argentina/Buenos_Aires', names: ['Buenos Aires', 'Buenos Aires', 'Buenos Aires', 'Buenos Aires', 'Буэнос-Айрес', 'Buenos Aires'], lat: -34.6, lon: -58.38 },
  { id: 'saopaulo', tz: 'America/Sao_Paulo', names: ['São Paulo', 'São Paulo', 'São Paulo', 'São Paulo', 'Сан-Паулу', 'São Paulo'], lat: -23.55, lon: -46.63 },
  { id: 'montevideo', tz: 'America/Montevideo', names: ['Montevideo', 'Montevideo', 'Montevidéu', 'Montevideo', 'Монтевидео', 'Montevideo'], lat: -34.9, lon: -56.16 },
  { id: 'panama', tz: 'America/Panama', names: ['Panamá', 'Panama City', 'Cidade do Panamá', 'Panama', 'Панама', 'Panama-Stadt'], lat: 8.98, lon: -79.52 },
  { id: 'sanjose', tz: 'America/Costa_Rica', names: ['San José', 'San José', 'San José', 'San José', 'Сан-Хосе', 'San José'], lat: 9.93, lon: -84.08 },
  { id: 'santodomingo', tz: 'America/Santo_Domingo', names: ['Santo Domingo', 'Santo Domingo', 'Santo Domingo', 'Saint-Domingue', 'Санто-Доминго', 'Santo Domingo'], lat: 18.49, lon: -69.93 },
  { id: 'newyork', tz: 'America/New_York', names: ['Nueva York', 'New York', 'Nova York', 'New York', 'Нью-Йорк', 'New York'], lat: 40.71, lon: -74.01 },
  { id: 'miami', tz: 'America/New_York', names: ['Miami', 'Miami', 'Miami', 'Miami', 'Майами', 'Miami'], lat: 25.76, lon: -80.19 },
  { id: 'chicago', tz: 'America/Chicago', names: ['Chicago', 'Chicago', 'Chicago', 'Chicago', 'Чикаго', 'Chicago'], lat: 41.88, lon: -87.63 },
  { id: 'denver', tz: 'America/Denver', names: ['Denver', 'Denver', 'Denver', 'Denver', 'Денвер', 'Denver'], lat: 39.74, lon: -104.99 },
  { id: 'losangeles', tz: 'America/Los_Angeles', names: ['Los Ángeles', 'Los Angeles', 'Los Angeles', 'Los Angeles', 'Лос-Анджелес', 'Los Angeles'], lat: 34.05, lon: -118.24 },
  { id: 'toronto', tz: 'America/Toronto', names: ['Toronto', 'Toronto', 'Toronto', 'Toronto', 'Торонто', 'Toronto'], lat: 43.65, lon: -79.38 },
  { id: 'vancouver', tz: 'America/Vancouver', names: ['Vancouver', 'Vancouver', 'Vancouver', 'Vancouver', 'Ванкувер', 'Vancouver'], lat: 49.28, lon: -123.12 },
  { id: 'honolulu', tz: 'Pacific/Honolulu', names: ['Honolulu', 'Honolulu', 'Honolulu', 'Honolulu', 'Гонолулу', 'Honolulu'], lat: 21.31, lon: -157.86 },
  { id: 'london', tz: 'Europe/London', names: ['Londres', 'London', 'Londres', 'Londres', 'Лондон', 'London'], lat: 51.51, lon: -0.13 },
  { id: 'lisbon', tz: 'Europe/Lisbon', names: ['Lisboa', 'Lisbon', 'Lisboa', 'Lisbonne', 'Лиссабон', 'Lissabon'], lat: 38.72, lon: -9.14 },
  { id: 'madrid', tz: 'Europe/Madrid', names: ['Madrid', 'Madrid', 'Madri', 'Madrid', 'Мадрид', 'Madrid'], lat: 40.42, lon: -3.7 },
  { id: 'paris', tz: 'Europe/Paris', names: ['París', 'Paris', 'Paris', 'Paris', 'Париж', 'Paris'], lat: 48.86, lon: 2.35 },
  { id: 'berlin', tz: 'Europe/Berlin', names: ['Berlín', 'Berlin', 'Berlim', 'Berlin', 'Берлин', 'Berlin'], lat: 52.52, lon: 13.4 },
  { id: 'rome', tz: 'Europe/Rome', names: ['Roma', 'Rome', 'Roma', 'Rome', 'Рим', 'Rom'], lat: 41.9, lon: 12.5 },
  { id: 'amsterdam', tz: 'Europe/Amsterdam', names: ['Ámsterdam', 'Amsterdam', 'Amsterdã', 'Amsterdam', 'Амстердам', 'Amsterdam'], lat: 52.37, lon: 4.9 },
  { id: 'zurich', tz: 'Europe/Zurich', names: ['Zúrich', 'Zurich', 'Zurique', 'Zurich', 'Цюрих', 'Zürich'], lat: 47.38, lon: 8.54 },
  { id: 'athens', tz: 'Europe/Athens', names: ['Atenas', 'Athens', 'Atenas', 'Athènes', 'Афины', 'Athen'], lat: 37.98, lon: 23.73 },
  { id: 'istanbul', tz: 'Europe/Istanbul', names: ['Estambul', 'Istanbul', 'Istambul', 'Istanbul', 'Стамбул', 'Istanbul'], lat: 41.01, lon: 28.98 },
  { id: 'moscow', tz: 'Europe/Moscow', names: ['Moscú', 'Moscow', 'Moscou', 'Moscou', 'Москва', 'Moskau'], lat: 55.76, lon: 37.62 },
  { id: 'cairo', tz: 'Africa/Cairo', names: ['El Cairo', 'Cairo', 'Cairo', 'Le Caire', 'Каир', 'Kairo'], lat: 30.04, lon: 31.24 },
  { id: 'lagos', tz: 'Africa/Lagos', names: ['Lagos', 'Lagos', 'Lagos', 'Lagos', 'Лагос', 'Lagos'], lat: 6.52, lon: 3.38 },
  { id: 'johannesburg', tz: 'Africa/Johannesburg', names: ['Johannesburgo', 'Johannesburg', 'Joanesburgo', 'Johannesburg', 'Йоханнесбург', 'Johannesburg'], lat: -26.2, lon: 28.05 },
  { id: 'dubai', tz: 'Asia/Dubai', names: ['Dubái', 'Dubai', 'Dubai', 'Dubaï', 'Дубай', 'Dubai'], lat: 25.2, lon: 55.27 },
  { id: 'mumbai', tz: 'Asia/Kolkata', names: ['Bombay', 'Mumbai', 'Mumbai', 'Bombay', 'Мумбаи', 'Mumbai'], lat: 19.08, lon: 72.88 },
  { id: 'bangkok', tz: 'Asia/Bangkok', names: ['Bangkok', 'Bangkok', 'Bangkok', 'Bangkok', 'Бангкок', 'Bangkok'], lat: 13.76, lon: 100.5 },
  { id: 'singapore', tz: 'Asia/Singapore', names: ['Singapur', 'Singapore', 'Singapura', 'Singapour', 'Сингапур', 'Singapur'], lat: 1.35, lon: 103.82 },
  { id: 'hongkong', tz: 'Asia/Hong_Kong', names: ['Hong Kong', 'Hong Kong', 'Hong Kong', 'Hong Kong', 'Гонконг', 'Hongkong'], lat: 22.32, lon: 114.17 },
  { id: 'shanghai', tz: 'Asia/Shanghai', names: ['Shanghái', 'Shanghai', 'Xangai', 'Shanghai', 'Шанхай', 'Shanghai'], lat: 31.23, lon: 121.47 },
  { id: 'seoul', tz: 'Asia/Seoul', names: ['Seúl', 'Seoul', 'Seul', 'Séoul', 'Сеул', 'Seoul'], lat: 37.57, lon: 126.98 },
  { id: 'tokyo', tz: 'Asia/Tokyo', names: ['Tokio', 'Tokyo', 'Tóquio', 'Tokyo', 'Токио', 'Tokio'], lat: 35.68, lon: 139.69 },
  { id: 'sydney', tz: 'Australia/Sydney', names: ['Sídney', 'Sydney', 'Sydney', 'Sydney', 'Сидней', 'Sydney'], lat: -33.87, lon: 151.21 },
  { id: 'auckland', tz: 'Pacific/Auckland', names: ['Auckland', 'Auckland', 'Auckland', 'Auckland', 'Окленд', 'Auckland'], lat: -36.85, lon: 174.76 },
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

/** La ciudad de la lista más cercana a unas coordenadas (a menos de ~120 km), para nombrar la ubicación. */
export function nearestCity(lat: number, lon: number): City | undefined {
  let best: City | undefined;
  let bestD = Infinity;
  for (const c of cities) {
    if (c.lat === undefined || c.lon === undefined) continue;
    const dx = (c.lon - lon) * Math.cos(((c.lat + lat) / 2) * (Math.PI / 180));
    const d = Math.hypot(c.lat - lat, dx) * 111;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return bestD < 120 ? best : undefined;
}
