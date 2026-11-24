import { mix, tones, type Tones } from './Palette'
import type { Kind } from './Weather'

// The scene is drawn on a coarse grid: one unit is one art pixel, which the app scales up.
// `crispEdges` keeps those pixels hard, and every animation moves in whole units via
// `steps()`, so motion jumps pixel by pixel instead of gliding.
const W = 192
const H = 108

const run = (x: number, y: number, w: number, h = 1) => `M${x} ${y}h${w}v${h}h${-w}z`
const path = (d: string, fill: string, attrs = '') => (d ? `<path d="${d}" fill="${fill}"${attrs}/>` : '')

// Deterministic randomness, so the same weather always draws the same scene.
function random(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647
}

// A pixel-art disc, row by row; `maxY` flattens the bottom, the way pixel clouds sit.
function disc(cx: number, cy: number, r: number, maxY = Infinity): string {
  let d = ''

  for (let dy = -r; dy <= r && cy + dy <= maxY; dy++) {
    const half = Math.floor(Math.sqrt((r + 0.5) ** 2 - dy * dy))

    d += run(cx - half, cy + dy, half * 2 + 1)
  }

  return d
}

function cloud(x: number, y: number, scale: number): string {
  const k = (n: number) => Math.round(n * scale)
  const floor = y + k(2)

  return disc(x, y, k(3), floor) + disc(x + k(6), y - k(2), k(5), floor) + disc(x + k(12), y, k(4), floor)
}

// A layer drawn twice, one width apart, and slid by one width: the loop has no seam.
const drifting = (content: string, className: string) =>
  `<g class="${className}">${content}<g transform="translate(${-W} 0)">${content}</g></g>`

const falling = (content: string, className: string) =>
  `<g class="${className}">${content}<g transform="translate(0 ${-H})">${content}</g></g>`

function sky(t: Tones): string {
  const bands = 6
  const bandHeight = 14
  let fills = ''
  let dithers = ''

  for (let i = 0; i < bands; i++) {
    const color = mix(t.sky[0], t.sky[1], i / (bands - 1))
    const y = i * bandHeight

    fills += path(run(0, y, W, i === bands - 1 ? H - y : bandHeight), color)

    if (i === bands - 1) continue

    // A dithered seam into the band below softens the steps, the pixel-art way.
    let d = ''

    for (let x = 0; x < W; x += 2) d += run(x, y + bandHeight, 1)
    for (let x = 1; x < W; x += 4) d += run(x, y + bandHeight + 1, 1)
    dithers += path(d, color)
  }

  return fills + dithers
}

function sun(): string {
  const [cx, cy] = [160, 22]
  const rays =
    run(cx, cy - 11, 1, 3) + run(cx, cy + 9, 1, 3) + run(cx - 11, cy, 3, 1) + run(cx + 9, cy, 3, 1) +
    run(cx - 9, cy - 9, 2, 2) + run(cx + 8, cy - 9, 2, 2) + run(cx - 9, cy + 8, 2, 2) + run(cx + 8, cy + 8, 2, 2)

  return (
    path(rays, '#ffe07a', ' class="pulse" opacity=".6"') +
    path(disc(cx, cy, 7), '#ffd34d') +
    path(disc(cx - 2, cy - 2, 3), '#ffe99a')
  )
}

function moon(): string {
  const [cx, cy] = [160, 20]

  return (
    path(disc(cx, cy, 9), '#efe8cf', ' opacity=".08"') +
    path(disc(cx, cy, 6), '#efe8cf') +
    path(run(cx - 3, cy - 3, 2, 2) + run(cx + 2, cy + 2, 2, 1) + run(cx - 2, cy + 3, 1, 1) + run(cx + 3, cy - 3, 1, 1), '#d8cfb2')
  )
}

function stars(rand: () => number): string {
  const groups = ['', '', '', '']

  for (let i = 0; i < 46; i++) {
    const x = Math.floor(rand() * W)
    const y = Math.floor(rand() * 64)

    // Keep the moon's patch of sky clear.
    if (Math.abs(x - 160) < 12 && Math.abs(y - 20) < 12) continue

    groups[i % 4] += i % 9 === 0 ? run(x - 1, y, 3) + run(x, y - 1, 1, 3) : run(x, y, 1)
  }

  return groups.map((d, i) => path(d, '#fff8e1', ` class="tw${i}" opacity=".85"`)).join('')
}

// A low ceiling of cloud across the top, for grey weather. Uneven bulges, so it reads as
// cloud and not as a trim.
function overcast(t: Tones, rand: () => number): string {
  let body = run(0, 0, W, 6)
  let shade = run(0, 1, W, 6)

  for (let x = -4; x < W + 8; x += 9 + Math.floor(rand() * 10)) {
    const r = 3 + Math.floor(rand() * 5)
    const y = 4 + Math.floor(rand() * 4)

    body += disc(x, y, r)
    shade += disc(x, y + 1, r)
  }

  return path(shade, mix(t.cloud[1], '#000000', 0.06)) + path(body, t.cloud[1])
}

type CloudSpot = readonly [x: number, y: number]

const FAR_CLOUDS: readonly CloudSpot[] = [[14, 16], [70, 24], [118, 12], [176, 28]]
const NEAR_CLOUDS: readonly CloudSpot[] = [[36, 40], [104, 46], [150, 36]]

function cloudLayer(t: Tones, spots: readonly CloudSpot[], scale: number, className: string): string {
  if (spots.length === 0) return ''

  const shade = spots.map(([x, y]) => cloud(x, y + 1, scale)).join('')
  const body = spots.map(([x, y]) => cloud(x, y, scale)).join('')

  return drifting(path(shade, t.cloud[1]) + path(body, t.cloud[0]), className)
}

// How much cloud each weather gets: [far spots, far scale, near spots, near scale].
const CLOUDS: Record<Kind, readonly [number, number, number, number]> = {
  clear: [0, 1, 0, 1],
  partly: [3, 1, 2, 1.4],
  cloudy: [4, 1.2, 3, 1.8],
  fog: [3, 1, 0, 1],
  rain: [4, 1.2, 3, 1.6],
  snow: [4, 1.2, 3, 1.6],
  storm: [4, 1.2, 3, 1.8],
}

const farTop = (x: number) => H - Math.round(24 + 5 * Math.sin(x / 21) + 3 * Math.sin(x / 8 + 1))
const nearTop = (x: number) => H - Math.round(12 + 3 * Math.sin(x / 14 + 2) + 2 * Math.sin(x / 5))

function hill(top: (x: number) => number): string {
  let d = ''

  for (let x = 0; x < W; x += 2) {
    const y = top(x)

    d += run(x, y, 2, H - y)
  }

  return d
}

function trees(): string {
  let d = ''

  for (const x of [10, 18, 56, 64, 116, 184]) {
    const base = nearTop(x - (x % 2))

    ;[1, 3, 3, 5, 5, 7].forEach((w, row) => (d += run(x - (w - 1) / 2, base - 8 + row, w)))
    d += run(x, base - 2, 1, 2)
  }

  return d
}

function cabin(kind: Kind, isDay: boolean): string {
  const cx = 170
  const base = nearTop(cx) + 1
  const sink = (color: string) => (isDay ? color : mix(color, '#0a0f1f', 0.7))
  const roof = kind === 'snow' ? sink('#eef3f7') : sink('#5b3a2a')
  const lamp = '#ffd27a'

  return (
    path(run(cx - 5, base - 6, 10, 9), sink('#8a5a3c')) +
    path(run(cx - 6, base - 7, 12) + run(cx - 5, base - 8, 10) + run(cx - 3, base - 9, 6) + run(cx - 1, base - 10, 2), roof) +
    path(run(cx + 1, base - 4, 2, 4), sink('#4a3022')) +
    // A lit window at night: the one warm light in the scene.
    (isDay
      ? path(run(cx - 3, base - 4, 2, 2), '#2d3440')
      : path(run(cx - 4, base - 5, 4, 4), lamp, ' opacity=".18"') + path(run(cx - 3, base - 4, 2, 2), lamp))
  )
}

function rain(t: Tones, rand: () => number, isDay: boolean): string {
  const color = mix(t.sky[1], '#ffffff', isDay ? 0.4 : 0.25)
  const columns = (offset: number, length: number) => {
    let d = ''

    for (let x = offset; x < W; x += 6) {
      const column = x + Math.floor(rand() * 3)
      const start = Math.floor(rand() * H)

      for (let i = 0; i < 3; i++) d += run(column, (start + i * 36) % H, 1, length)
    }

    return d
  }

  return (
    falling(path(columns(3, 2), color, ' opacity=".4"'), 'rainfar') +
    falling(path(columns(0, 3), color, ' opacity=".7"'), 'rain')
  )
}

function snow(rand: () => number): string {
  const flakes = (count: number) => {
    let d = ''

    for (let i = 0; i < count; i++) d += run(Math.floor(rand() * W), Math.floor(rand() * H), 1)

    return d
  }

  return (
    `<g class="sway">${falling(path(flakes(90), '#ffffff', ' opacity=".5"'), 'snowfar')}</g>` +
    falling(path(flakes(70), '#ffffff', ' opacity=".9"'), 'snow')
  )
}

function fog(rand: () => number, isDay: boolean): string {
  return [52, 60, 68, 76, 86]
    .map((y, i) => {
      let d = ''
      let x = Math.floor(rand() * 20)

      while (x < W) {
        const w = 12 + Math.floor(rand() * 30)

        d += run(x, y, Math.min(w, W - x), 2)
        x += w + 6 + Math.floor(rand() * 16)
      }

      return drifting(path(d, isDay ? '#ffffff' : '#b8c2cc', isDay ? ' opacity=".35"' : ' opacity=".18"'), `fog${i % 3}`)
    })
    .join('')
}

function bolt(): string {
  const [x, y] = [84, 27]
  const d =
    run(x, y, 2, 4) + run(x - 2, y + 4, 2, 4) + run(x - 4, y + 8, 2, 3) + run(x - 4, y + 11, 6, 1) +
    run(x, y + 12, 2, 4) + run(x - 2, y + 16, 2, 4) + run(x - 4, y + 20, 2, 4)

  // Resting opacity 0, so with reduced motion there is no bolt at all.
  return path(d, '#fff6c4', ' class="bolt" opacity="0"')
}

// Slow on purpose: the app holds a scene still if it flashes or moves too hard.
const CSS = [
  '@keyframes drift{from{transform:translateX(0)}to{transform:translateX(192px)}}',
  '@keyframes fall{from{transform:translateY(0)}to{transform:translateY(108px)}}',
  '@keyframes sway{from{transform:translateX(0)}to{transform:translateX(2px)}}',
  '@keyframes tw{0%,100%{opacity:.85}50%{opacity:.2}}',
  '@keyframes pulse{from{opacity:.3}to{opacity:.9}}',
  '@keyframes bolt{0%{opacity:0}95%{opacity:1}97%{opacity:0}}',
  '.far{animation:drift 260s steps(192) infinite}',
  '.near{animation:drift 160s steps(192) infinite}',
  '.fog0{animation:drift 120s steps(192) infinite}',
  '.fog1{animation:drift 180s steps(192) infinite}',
  '.fog2{animation:drift 240s steps(192) infinite}',
  '.rain{animation:fall 3s steps(108) infinite}',
  '.rainfar{animation:fall 4.5s steps(108) infinite}',
  '.scene-storm .rain{animation-duration:2s}',
  '.scene-storm .rainfar{animation-duration:3s}',
  '.snow{animation:fall 16s steps(108) infinite}',
  '.snowfar{animation:fall 26s steps(108) infinite}',
  '.sway{animation:sway 5s steps(2) infinite alternate}',
  '.tw0{animation:tw 5s steps(2) infinite}',
  '.tw1{animation:tw 7s steps(2) infinite -2s}',
  '.tw2{animation:tw 9s steps(2) infinite -5s}',
  '.tw3{animation:tw 6s steps(2) infinite -1s}',
  '.pulse{animation:pulse 3s steps(3) infinite alternate}',
  '.bolt{animation:bolt 11s steps(1) infinite}',
].join('')

export function sceneSvg(kind: Kind, isDay: boolean): string {
  const t = tones(kind, isDay)
  const rand = random(kind.length * 977 + (isDay ? 1 : 2))
  const [farCount, farScale, nearCount, nearScale] = CLOUDS[kind]
  const isGrey = kind === 'cloudy' || kind === 'rain' || kind === 'snow' || kind === 'storm'
  const hasSky = kind === 'clear' || kind === 'partly'

  const layers = [
    sky(t),
    hasSky && !isDay ? stars(rand) : '',
    hasSky ? (isDay ? sun() : moon()) : '',
    isGrey ? overcast(t, rand) : '',
    cloudLayer(t, FAR_CLOUDS.slice(0, farCount), farScale, 'far'),
    cloudLayer(t, NEAR_CLOUDS.slice(0, nearCount), nearScale, 'near'),
    kind === 'storm' ? bolt() : '',
    path(hill(farTop), t.ground[0]),
    kind === 'fog' ? fog(rand, isDay) : '',
    path(hill(nearTop), t.ground[1]),
    path(trees(), t.tree),
    cabin(kind, isDay),
    kind === 'rain' || kind === 'storm' ? rain(t, rand, isDay) : '',
    kind === 'snow' ? snow(rand) : '',
  ]

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">` +
    // Prefixed: a bare `rain` or `snow` here would give the whole scene the falling animation.
    `<style>${CSS}</style><g class="scene-${kind}">${layers.join('')}</g></svg>`
  )
}
