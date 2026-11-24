import type { ThemeColors } from 'claude-code'

import { makeColors } from './make-colors.js'
import type { Kind } from './Weather'

export type Tones = {
  sky: readonly [top: string, horizon: string]
  cloud: readonly [body: string, shade: string]
  ground: readonly [far: string, near: string]
  tree: string
  accent: string
}

// Daytime colors per weather. Night is derived below instead of written out twice.
const DAY: Record<Kind, Tones> = {
  clear: { sky: ['#3d7fd6', '#b9d8f2'], cloud: ['#ffffff', '#d5e0ec'], ground: ['#7fa86b', '#557f4d'], tree: '#2f5b3a', accent: '#2f6fbf' },
  partly: { sky: ['#4a86d0', '#bcd6ee'], cloud: ['#f6f8fb', '#cdd8e4'], ground: ['#7fa86b', '#557f4d'], tree: '#2f5b3a', accent: '#3a74b8' },
  cloudy: { sky: ['#7f8fa3', '#bac4cf'], cloud: ['#d3d9e0', '#a9b3bf'], ground: ['#6f8a66', '#4f6a4b'], tree: '#2f4a35', accent: '#56708f' },
  fog: { sky: ['#a7b1b6', '#d6dcde'], cloud: ['#dfe4e6', '#c3cacd'], ground: ['#9aa8a2', '#7e8d87'], tree: '#5f6f69', accent: '#4f6e6b' },
  rain: { sky: ['#4d5c70', '#8494a6'], cloud: ['#6b7787', '#535d6b'], ground: ['#5b7458', '#425a42'], tree: '#273a2a', accent: '#3d6894' },
  snow: { sky: ['#9db2c7', '#dce5ee'], cloud: ['#e9eef3', '#c7d1dc'], ground: ['#eef3f7', '#d4dee8'], tree: '#3c5a4a', accent: '#3f78a8' },
  storm: { sky: ['#2f3545', '#5d6578'], cloud: ['#474e5e', '#363c49'], ground: ['#4a5f49', '#354634'], tree: '#22301f', accent: '#6a5aa8' },
}

const NIGHT_INK = '#0a0f1f'

export function mix(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)

  return (
    '#' +
    [0, 1, 2]
      .map(i => Math.round(channel(a, i) * (1 - t) + channel(b, i) * t).toString(16).padStart(2, '0'))
      .join('')
  )
}

export function tones(kind: Kind, isDay: boolean): Tones {
  const day = DAY[kind]

  if (isDay) return day

  // Night: every color sinks most of the way toward a deep navy, so the scene keeps its weather.
  const sink = (color: string) => mix(color, NIGHT_INK, 0.78)

  return {
    sky: [sink(day.sky[0]), sink(day.sky[1])],
    cloud: [sink(day.cloud[0]), sink(day.cloud[1])],
    ground: [sink(day.ground[0]), sink(day.ground[1])],
    tree: sink(day.tree),
    accent: day.accent,
  }
}

// The app's own colors, tinted by the weather's sky. Both modes are given; register.tsx
// picks the mode from the real sun.
export function themeColors(kind: Kind): { theme: ThemeColors; problems: string[] } {
  const { sky, accent } = DAY[kind]
  // Light surfaces take only a hint of the sky: a storm's grey would sink the text under 4.5:1.
  const lightPage = mix(sky[1], '#ffffff', 0.8)
  const ink = mix(sky[0], '#000000', 0.8)
  const darkPage = mix(sky[0], '#000000', 0.86)
  const glow = mix(sky[1], '#ffffff', 0.8)

  return makeColors({
    label: `Pixel weather, ${kind}`,
    // The theme id allows only letters, digits, _ and -; the label alone would not pass.
    id: `pixel-weather-${kind}`,
    roles: { accent, danger: '#b3392f', success: '#4e7d3a', warning: '#a86f14', pro: '#6d4f94' },
    light: {
      gray: {
        anchors: {
          'surface-0': lightPage,
          'surface-1': mix(sky[1], '#ffffff', 0.88),
          'surface-2': mix(sky[1], '#ffffff', 0.95),
          'text-primary': ink,
          'text-secondary': mix(ink, lightPage, 0.25),
          'text-muted': mix(ink, lightPage, 0.42),
        },
      },
    },
    dark: {
      gray: {
        anchors: {
          'surface-0': darkPage,
          // Kept close to the page: a light surface-3 is what trips muted text and roles.
          'surface-1': mix(sky[0], '#000000', 0.845),
          'surface-2': mix(sky[0], '#000000', 0.83),
          'surface-3': mix(sky[0], '#000000', 0.815),
          'text-primary': glow,
          'text-secondary': mix(glow, darkPage, 0.25),
          'text-muted': mix(glow, darkPage, 0.38),
        },
      },
    },
  })
}
