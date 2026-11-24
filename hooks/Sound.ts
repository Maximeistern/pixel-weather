import type { ThemeSound } from 'claude-code'

import type { Kind } from './Weather'

// Layers of noise the app synthesizes itself, so no audio file ships with the mod. It plays
// only once the person turns on the speaker in the session's title bar: that is the switch.

const RAIN: ThemeSound = {
  ambience: {
    layers: [
      // Steady hiss, its brightness swelling and easing over 16 seconds.
      { wave: 'pink', drone: true, gain: 0.22, filter: { type: 'lowpass', hz: 1800, to: 2600 } },
      // Drops ticking on leaves and roofs.
      { wave: 'crackle', drone: true, gain: 0.1, filter: { type: 'highpass', hz: 1200 } },
    ],
    reverb: 0.2,
  },
}

const STORM: ThemeSound = {
  ambience: {
    layers: [
      { wave: 'pink', drone: true, gain: 0.28, filter: { type: 'lowpass', hz: 2200, to: 3200 }, tremolo: { hz: 0.08, depth: 0.3 } },
      { wave: 'crackle', drone: true, gain: 0.14, filter: { type: 'highpass', hz: 1200 } },
      // Distant thunder: a slow low rumble about every 25 seconds.
      { wave: 'brown', scatter: 0.04, gain: 0.45, attack: 0.4, release: 4, filter: { type: 'lowpass', hz: 160 } },
    ],
    reverb: 0.35,
  },
}

export const soundFor = (kind: Kind): ThemeSound | undefined =>
  kind === 'rain' ? RAIN : kind === 'storm' ? STORM : undefined
