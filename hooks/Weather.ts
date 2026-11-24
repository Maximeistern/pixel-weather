// Open-Meteo: free, no API key. Pure functions only; register.tsx does the fetching,
// so the parsing can be tested without a network.

export type Kind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'

export const KINDS: readonly Kind[] = ['clear', 'partly', 'cloudy', 'fog', 'rain', 'snow', 'storm']

export type Place = { name: string; region: string; latitude: number; longitude: number }

export type Weather = { kind: Kind; isDay: boolean; temperature: number }

export const LABELS: Record<Kind, string> = {
  clear: 'klart',
  partly: 'halvklart',
  cloudy: 'mulet',
  fog: 'dimma',
  rain: 'regn',
  snow: 'snö',
  storm: 'åska',
}

// WMO weather codes as Open-Meteo reports them. Snow sits inside the rain range,
// so it is checked first.
export function kindFromCode(code: number): Kind {
  if (code === 0) return 'clear'
  if (code <= 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'storm'
  if (code >= 51 && code <= 82) return 'rain'
  return 'cloudy'
}

// "Lund, Skåne": the search takes the name alone, and the part after the comma picks
// among places that share it.
export function splitQuery(query: string): { name: string; hint: string } {
  // The command's hint reads `[ort, region]`, and people type the brackets too.
  const [name = '', ...rest] = query.replace(/[[\]]/g, '').split(',')

  return { name: name.trim(), hint: rest.join(',').trim().toLowerCase() }
}

export const geocodeUrl = (name: string) =>
  `https://geocoding-api.open-meteo.com/v1/search?count=10&language=sv&format=json&name=${encodeURIComponent(name)}`

export const describePlace = (place: Place) => (place.region ? `${place.name} (${place.region})` : place.name)

export const forecastUrl = (place: Place) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,is_day`

// Both responses come from outside the app: check each field before trusting it.
// With a hint, only a place whose region or country starts with it counts: picking the
// biggest namesake instead is exactly the "wrong place" this is meant to fix.
export function parsePlace(text: string, hint = ''): Place | undefined {
  const results: unknown = JSON.parse(text)?.results

  if (!Array.isArray(results)) return undefined

  const located = results.filter(r => typeof r?.latitude === 'number' && typeof r?.longitude === 'number')
  const matches = (r: Record<string, unknown>) =>
    [r.admin1, r.admin2, r.country, r.country_code].some(v => typeof v === 'string' && v.toLowerCase().startsWith(hint))
  const hit = hint ? located.find(matches) : located[0]

  if (hit === undefined) return undefined

  return {
    name: String(hit.name ?? ''),
    region: [hit.admin1, hit.country].filter(v => typeof v === 'string' && v !== '').join(', '),
    latitude: hit.latitude,
    longitude: hit.longitude,
  }
}

export function parseWeather(text: string): Weather | undefined {
  const current = JSON.parse(text)?.current

  if (typeof current?.weather_code !== 'number' || typeof current?.temperature_2m !== 'number') return undefined

  return {
    kind: kindFromCode(current.weather_code),
    isDay: current.is_day === 1,
    temperature: Math.round(current.temperature_2m),
  }
}
