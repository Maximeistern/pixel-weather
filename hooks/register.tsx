import type { EngineInterface, Register, ThemeBackdrop, ThemeSetArgs } from 'claude-code'

import { themeColors } from './Palette'
import { sceneSvg } from './Scene'
import { soundFor } from './Sound'
import {
  describePlace,
  forecastUrl,
  geocodeUrl,
  LABELS,
  parsePlace,
  parseWeather,
  splitQuery,
  type Kind,
  type Place,
} from './Weather'

const REFRESH_MS = 15 * 60_000
const SCENE = /^pw-(clear|partly|cloudy|fog|rain|snow|storm)-(day|night)$/
const HOW_TO = 'Byt med /ort Malmö, eller /ort Lund, Skåne när namnet finns på flera ställen.'

// What one load of the mod remembers. It starts over on a reload, which is fine: a reload
// re-runs session.start. (The engine lets `$` reach only top-level functions, so the state
// is passed in rather than closed over.)
type State = { city: string; place?: Place; shownScene?: string }

async function findPlace($: EngineInterface, query: string): Promise<Place | undefined> {
  const { name, hint } = splitQuery(query)
  const found = await $.http.fetch(geocodeUrl(name))

  return found.ok ? parsePlace(found.text, hint) : undefined
}

// Every look worth trying, newest shape first. A host refuses the whole set over one
// attribute it doesn't know, so it steps down: rain sound first (asked for), then the mode
// following the real sun, then the older host that names the scene `id`.
function lookAttempts(scene: string, kind: Kind, isDay: boolean): ThemeSetArgs[] {
  const { theme } = themeColors(kind)
  const sound = soundFor(kind)
  const glass = { blur: 10, opacity: 0.72 }
  const attempts: ThemeSetArgs[] = []

  for (const backdrop of [{ scene, glass }, { id: scene, glass } as unknown as ThemeBackdrop]) {
    for (const withSound of sound ? [true, false] : [false]) {
      for (const withScheme of [true, false]) {
        attempts.push({
          backdrop,
          colors: theme,
          ...(withSound && { sound }),
          ...(withScheme && { overrideColorScheme: isDay ? 'light' : 'dark' }),
        })
      }
    }
  }

  return attempts
}

async function showWeather($: EngineInterface, state: State) {
  try {
    state.place ??= await findPlace($, state.city)

    if (state.place === undefined) {
      $.ui.status(`Väder: hittar inte "${state.city}". ${HOW_TO}`)

      return
    }
    const answer = await $.http.fetch(forecastUrl(state.place))
    const weather = answer.ok ? parseWeather(answer.text) : undefined

    if (weather === undefined) {
      $.ui.status('Väder: kunde inte hämta vädret just nu')

      return
    }
    $.ui.status(`${state.place.name} ${weather.temperature}°, ${LABELS[weather.kind]}`)

    const scene = `pw-${weather.kind}-${weather.isDay ? 'day' : 'night'}`

    if (scene === state.shownScene) return

    const unpainted = themeColors(weather.kind).problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) $.ui.log(unpainted)

    let refusal: unknown

    for (const attempt of lookAttempts(scene, weather.kind, weather.isDay)) {
      try {
        const set = await $.theme.set(attempt)

        // Only after it took: a refused set is tried again on the next refresh.
        state.shownScene = scene
        if (!set.isDrawn) $.ui.log(set.reason)
        if (soundFor(weather.kind) && attempt.sound === undefined) {
          $.ui.log(`Regnljudet togs inte emot: ${String(refusal)}`)
        }

        return
      } catch (error) {
        refusal = error
      }
    }
    throw refusal
  } catch (error) {
    // Offline or a malformed answer: keep the last scene and say why in the status line.
    $.ui.status(`Väder: ${String(error)}`)
  }
}

export const register: Register = (on, options) => {
  const state: State = { city: (typeof options.city === 'string' && options.city.trim()) || 'Stockholm' }

  on('session.start', async ($, e, next) => {
    // Not awaited: the session starts at once, and the scene arrives a moment later.
    $.clock.after(0, () => void showWeather($, state))
    $.clock.every(REFRESH_MS, () => void showWeather($, state))

    // Caught on its own: a missing /ort must not take the weather down with it.
    await $.command
      .register({ name: 'ort', description: 'Byt ort för vädret i bakgrunden', argumentHint: '[ort, region]' })
      .catch(error => $.ui.log(`/ort kunde inte registreras: ${String(error)}`))

    return next(e)
  })

  on('command.run', { command: 'ort' }, async ($, e) => {
    const query = e.args.trim()
    // The answer is for the person: the model has no use for it.
    const reply = (text: string) => ({ text, isTextDisplayOnly: true as const })

    if (query === '') {
      return reply(state.place ? `Vädret visas för ${describePlace(state.place)}. ${HOW_TO}` : `Ingen ort hittad än. ${HOW_TO}`)
    }
    const found = await findPlace($, query).catch(() => undefined)

    if (found === undefined) return reply(`Hittar ingen ort som matchar "${query}". ${HOW_TO}`)

    state.place = found
    state.shownScene = undefined
    await showWeather($, state)

    // Saved as the mod's own setting, so the next session starts here too and one place
    // decides the city. The change reloads the mod, which is harmless.
    const row = (await $.config.list()).find(r => r.key.startsWith('pixel-weather') && r.key.endsWith('.city'))
    const saved = row ? await $.config.set({ key: row.key, value: query }) : { deny: 'no row' }
    const note = saved.deny !== undefined ? ' Det gäller den här sessionen; inställningen gick inte att spara.' : ''

    return reply(`Vädret visas nu för ${describePlace(found)}.${note}`)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    // The older host hands the scene's name over as `id`.
    const props = e.props as typeof e.props & { id?: string }
    const match = SCENE.exec(props.scene ?? props.id ?? '')

    if (match === null || (e.surface !== 'desktop' && e.surface !== 'mobile')) return next(e)

    const kind = match[1] as Kind
    const isDay = match[2] === 'day'
    const { Svg } = $.ui.resolve(e)

    return (
      <Svg
        source={sceneSvg(kind, isDay)}
        alt={`Pixelbild av vädret ute: ${LABELS[kind]}, ${isDay ? 'dag' : 'natt'}`}
        isInteractive
      />
    )
  })
}
