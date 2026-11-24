import { expect, mock, test } from 'claude-code/testing'

import { themeColors } from '../hooks/Palette'
import { sceneSvg } from '../hooks/Scene'
import { soundFor } from '../hooks/Sound'
import { KINDS, kindFromCode, parsePlace, parseWeather, splitQuery } from '../hooks/Weather'

const GEOCODE = JSON.stringify({ results: [{ name: 'Göteborg', latitude: 57.7, longitude: 11.97 }] })
const TWO_LUNDS = JSON.stringify({
  results: [
    { name: 'Lund', admin1: 'Skåne', country: 'Sverige', country_code: 'SE', latitude: 55.7, longitude: 13.19 },
    { name: 'Lund', admin1: 'Agder', country: 'Norge', country_code: 'NO', latitude: 58.46, longitude: 6.43 },
  ],
})

test('a hint after the comma picks among namesakes, and never guesses', () => {
  expect(parsePlace(TWO_LUNDS)?.region).toBe('Skåne, Sverige')
  expect(parsePlace(TWO_LUNDS, 'norge')?.region).toBe('Agder, Norge')
  expect(parsePlace(TWO_LUNDS, 'se')?.latitude).toBe(55.7)
  expect(parsePlace(TWO_LUNDS, 'finland')).toBe(undefined)
  expect(splitQuery('[Trelleborg, Skåne]')).toEqual({ name: 'Trelleborg', hint: 'skåne' })
})

test('rain and storm have sound, dry weather is silent', () => {
  expect(soundFor('rain')?.ambience?.layers.length).toBe(2)
  expect(soundFor('storm')?.ambience?.layers.length).toBe(3)
  expect(soundFor('clear')).toBe(undefined)
})

const RUN = { command: 'ort', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

test('/ort switches the place and saves it as the setting', async ($, on) => {
  const saved: unknown[] = []

  on('http.fetch', (_, e) => ({
    value: { status: 200, ok: true, headers: {}, text: e.url.includes('geocoding') ? TWO_LUNDS : FORECAST },
  }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'backdrop' } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('config.list', () => ({
    value: [
      {
        key: 'pixel-weather.city',
        label: 'City',
        kind: 'text',
        value: 'Stockholm',
        provider: { plugin: 'pixel-weather', tier: 'user' },
        isLocked: false,
      },
    ],
  }))
  on('config.set', (_, e) => {
    saved.push(e.value)

    return { value: e.value }
  })

  const switched = await $.command.run({ ...RUN, args: 'Lund, Norge' })

  expect(switched.text).toBe('Vädret visas nu för Lund (Agder, Norge).')
  expect(saved).toEqual(['Lund, Norge'])

  const unknown = await $.command.run({ ...RUN, args: 'Lund, Finland' })

  expect(unknown.text).toContain('Hittar ingen ort som matchar "Lund, Finland"')
  expect(saved.length).toBe(1)
})
const FORECAST = JSON.stringify({ current: { temperature_2m: 4.4, weather_code: 61, is_day: 0 } })

test('weather codes land on the right scene', () => {
  expect(kindFromCode(0)).toBe('clear')
  expect(kindFromCode(2)).toBe('partly')
  expect(kindFromCode(48)).toBe('fog')
  expect(kindFromCode(63)).toBe('rain')
  expect(kindFromCode(73)).toBe('snow')
  expect(kindFromCode(86)).toBe('snow')
  expect(kindFromCode(96)).toBe('storm')
  expect(parseWeather('{"current":{}}')).toBe(undefined)
})

test('every scene fits, every palette paints, nothing the engine refuses', () => {
  for (const kind of KINDS) {
    const unpainted = themeColors(kind).problems.filter(line => line.startsWith("Desktop won't paint"))

    expect(unpainted).toEqual([])

    for (const isDay of [true, false]) {
      const svg = sceneSvg(kind, isDay)

      expect(svg.length < 131_072).toBe(true)
      expect(/href|<image|NaN|undefined|Infinity/.test(svg)).toBe(false)
    }
  }
})

test('the session starts on the weather outside', async ($, on) => {
  const clock = mock.clock(on)
  const urls: string[] = []
  const statuses: string[] = []
  let backdrop: unknown

  on('http.fetch', (_, e) => {
    urls.push(e.url)

    return { value: { status: 200, ok: true, headers: {}, text: e.url.includes('geocoding') ? GEOCODE : FORECAST } }
  })
  on('theme.set', (_, e) => {
    backdrop = e.backdrop

    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'ort' } }))
  on('ui.status', (_, e) => {
    statuses.push(String(e.text))

    return { value: undefined }
  })
  on('ui.log', () => ({ value: undefined }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.settle()

  // Whichever shape this host took, the scene is the rainy night in Göteborg.
  expect(JSON.stringify(backdrop)).toContain('"pw-rain-night"')
  expect(statuses).toEqual(['Göteborg 4°, regn'])

  // Fifteen minutes on, the same weather: the forecast is asked again, the place is not.
  await clock.advance(15 * 60_000)
  expect(urls.filter(url => url.includes('geocoding')).length).toBe(1)
  expect(urls.filter(url => url.includes('forecast')).length).toBe(2)

  const ui = await $.ui.mount({
    plugin: 'pixel-weather',
    surface: 'desktop',
    component: 'Backdrop',
    requestId: 'backdrop',
    props: { scene: 'pw-rain-night', plugin: 'pixel-weather', glass: false },
  })

  expect(await ui.find({ type: 'Svg' })).toBeTruthy()
  await ui.unmount()
})
