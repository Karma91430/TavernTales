import { memo, useMemo } from 'react'
import type { Environment, TimeOfDay } from '../engine/types'

// Procedural parallax silhouettes, drawn in a 1600×600 space (ground at y=600).

const W = 1600
const H = 600

function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
type R = () => number
const between = (r: R, a: number, b: number) => a + r() * (b - a)

function ridge(r: R, base: number, amp: number, steps: number): { d: string; peaks: [number, number][] } {
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) pts.push([-60 + (i * (W + 120)) / steps, base - (i % 2 ? amp * between(r, 0.55, 1) : amp * between(r, 0.05, 0.35))])
  return { d: `M-60 ${H} ${pts.map(([x, y]) => `L${x.toFixed(0)} ${y.toFixed(0)}`).join(' ')} L${W + 60} ${H}Z`, peaks: pts.filter((_, i) => i % 2) }
}

function snowcaps(peaks: [number, number][]) {
  return peaks.map(([x, y]) => `M${x} ${y} L${x - 26} ${y + 34} L${x - 8} ${y + 26} L${x + 4} ${y + 38} L${x + 24} ${y + 30}Z`).join(' ')
}

function hills(r: R, base: number, amp: number, n = 6) {
  const seg = (W + 200) / n
  let d = `M-100 ${H} L-100 ${base}`
  for (let i = 0; i < n; i++) {
    const x0 = -100 + i * seg
    d += ` Q${x0 + seg / 2} ${base - amp * between(r, 0.4, 1)} ${x0 + seg} ${base - amp * between(r, -0.2, 0.3)}`
  }
  return `${d} L${W + 100} ${H}Z`
}

function pines(r: R, base: number, count: number, hMin: number, hMax: number, snowy = false) {
  let d = ''
  let caps = ''
  for (let i = 0; i < count; i++) {
    const x = between(r, -40, W + 40)
    const h = between(r, hMin, hMax)
    const w = h * 0.38
    const y = base + between(r, -8, 14)
    d += `M${x} ${y - h} L${x - w * 0.55} ${y - h * 0.45} L${x - w * 0.25} ${y - h * 0.48} L${x - w} ${y} L${x + w} ${y} L${x + w * 0.25} ${y - h * 0.48} L${x + w * 0.55} ${y - h * 0.45}Z `
    d += `M${x - 4} ${y} h8 v${H - y} h-8Z `
    if (snowy) caps += `M${x} ${y - h} L${x - w * 0.3} ${y - h * 0.72} L${x + w * 0.3} ${y - h * 0.72}Z `
  }
  return { d: d + `M-60 ${base + 6} H${W + 60} V${H} H-60Z`, caps }
}

function town(r: R, base: number) {
  let d = ''
  const windows: [number, number][] = []
  let x = -30
  while (x < W + 30) {
    const w = between(r, 60, 120)
    const h = between(r, 50, 120)
    const roof = between(r, 25, 55)
    d += `M${x} ${base} V${base - h} L${x + w / 2} ${base - h - roof} L${x + w} ${base - h} V${base}Z `
    if (r() < 0.5) d += `M${x + w * 0.7} ${base - h - roof * 0.4} h10 v-${roof * 0.6} h-10Z `
    for (let k = 0; k < 2; k++) if (r() < 0.7) windows.push([x + w * (0.25 + k * 0.35), base - h * between(r, 0.35, 0.7)])
    x += w + between(r, -6, 18)
  }
  return { d: d + `M-60 ${base} H${W + 60} V${H} H-60Z`, windows }
}

function castle(r: R, base: number) {
  const cx = between(r, 560, 1040)
  const merlons = (x0: number, x1: number, y: number) => {
    let s = ''
    for (let x = x0; x < x1 - 10; x += 22) s += `M${x} ${y} h12 v-14 h-12Z `
    return s
  }
  let d = `M${cx - 260} ${base} V${base - 120} H${cx + 260} V${base}Z ` + merlons(cx - 260, cx + 260, base - 120)
  d += `M${cx - 70} ${base} V${base - 230} H${cx + 70} V${base}Z ` + merlons(cx - 70, cx + 70, base - 230)
  const windows: [number, number][] = [[cx - 30, base - 190], [cx + 22, base - 190], [cx - 4, base - 150]]
  for (const [tx, th] of [[cx - 280, 200], [cx + 250, 210], [cx - 150, 160], [cx + 140, 170]] as const) {
    d += `M${tx} ${base} V${base - th} H${tx + 34} V${base}Z M${tx - 6} ${base - th} L${tx + 17} ${base - th - 60} L${tx + 40} ${base - th}Z `
    windows.push([tx + 13, base - th + 40])
  }
  return { d: d + hills(r, base + 10, 30), windows }
}

function temple(r: R, base: number) {
  const cx = between(r, 600, 1000)
  let d = `M${cx - 240} ${base} V${base - 24} H${cx + 240} V${base}Z M${cx - 220} ${base - 24} V${base - 40} H${cx + 220} V${base - 24}Z `
  for (let i = 0; i < 7; i++) {
    const x = cx - 200 + i * 66
    d += `M${x} ${base - 40} V${base - 210} H${x + 26} V${base - 40}Z `
  }
  d += `M${cx - 235} ${base - 210} H${cx + 235} V${base - 230} H${cx - 235}Z M${cx - 245} ${base - 230} L${cx} ${base - 310} L${cx + 245} ${base - 230}Z`
  return d + ' ' + hills(r, base + 8, 20)
}

function arches(r: R, base: number, count: number) {
  let d = `M-60 0 H${W + 60} V60 H-60Z `
  const span = W / count
  for (let i = 0; i <= count; i++) {
    const x = i * span
    d += `M${x - 30} ${base} V60 H${x + 30} V${base}Z `
    if (i < count) d += `M${x + 30} 60 H${x + span - 30} V${110 + between(r, 0, 20)} Q${x + span / 2} 40 ${x + 30} ${110}Z `
  }
  return d + `M-60 ${base} H${W + 60} V${H} H-60Z`
}

function stalactites(r: R, top: boolean, count: number, maxH: number) {
  let d = top ? `M-60 0 H${W + 60} V30 H-60Z ` : `M-60 ${H - 20} H${W + 60} V${H} H-60Z `
  for (let i = 0; i < count; i++) {
    const x = between(r, -20, W + 20)
    const w = between(r, 18, 60)
    const h = between(r, maxH * 0.3, maxH)
    d += top ? `M${x - w / 2} 20 L${x} ${20 + h} L${x + w / 2} 20Z ` : `M${x - w / 2} ${H - 10} L${x} ${H - 10 - h} L${x + w / 2} ${H - 10}Z `
  }
  return d
}

function graves(r: R, base: number) {
  let d = ''
  for (let i = 0; i < 16; i++) {
    const x = between(r, 0, W)
    const h = between(r, 30, 60)
    if (r() < 0.4) d += `M${x - 3} ${base} v-${h + 20} h6 v${h + 20}Z M${x - 16} ${base - h} h32 v6 h-32Z `
    else d += `M${x - 16} ${base} V${base - h} Q${x} ${base - h - 18} ${x + 16} ${base - h} V${base}Z `
  }
  return d + hills(r, base + 6, 18)
}

function deadTrees(r: R, base: number, count: number) {
  let d = ''
  for (let i = 0; i < count; i++) {
    const x = between(r, -20, W + 20)
    const h = between(r, 120, 260)
    d += `M${x - 6} ${base} L${x - 3} ${base - h} L${x + 3} ${base - h} L${x + 6} ${base}Z `
    for (let b = 0; b < 4; b++) {
      const y = base - h * between(r, 0.4, 0.95)
      const dir = r() < 0.5 ? -1 : 1
      const len = between(r, 30, 80)
      d += `M${x} ${y} L${x + dir * len} ${y - len * 0.6} L${x + dir * (len + 4)} ${y - len * 0.6 + 4} L${x} ${y + 6}Z `
    }
  }
  return d + `M-60 ${base} H${W + 60} V${H} H-60Z`
}

function reeds(r: R, base: number) {
  let d = ''
  for (let i = 0; i < 70; i++) {
    const x = between(r, 0, W)
    const h = between(r, 30, 90)
    d += `M${x} ${base} Q${x + between(r, -10, 10)} ${base - h / 2} ${x + between(r, -14, 14)} ${base - h} L${x + 3} ${base}Z `
  }
  return d + `M-60 ${base} H${W + 60} V${H} H-60Z`
}

function dunes(r: R, base: number, amp: number) {
  let d = `M-100 ${H} L-100 ${base}`
  for (let i = 0; i < 4; i++) {
    const x0 = -100 + i * 470
    d += ` C${x0 + 150} ${base - amp * between(r, 0.6, 1.2)} ${x0 + 300} ${base - amp * between(r, 0.6, 1.2)} ${x0 + 470} ${base}`
  }
  return `${d} L${W + 100} ${H}Z`
}

function waves(base: number, amp: number) {
  let d = `M0 ${H} L0 ${base}`
  for (let x = 0; x < W * 2; x += 100) d += ` Q${x + 25} ${base - amp} ${x + 50} ${base} T${x + 100} ${base}`
  return `${d} L${W * 2} ${H}Z`
}

function cliff(r: R) {
  const d = `M-60 ${H} V300 L120 290 L210 330 L300 360 L360 430 L420 600Z`
  const lighthouse = `M170 290 L178 170 H202 L210 290Z M172 170 H208 V156 H172Z M178 156 L190 136 L202 156Z`
  return { d: d + ' ' + lighthouse + ' ' + stalactites(r, false, 0, 0), light: [190, 162] as [number, number] }
}

interface Layer {
  d: string
  depth: 0 | 1 | 2
  caps?: string
  windows?: [number, number][]
  light?: [number, number]
  wave?: boolean
}

function layersFor(env: Environment, seed: number): Layer[] {
  const r = rng(seed)
  switch (env) {
    case 'forest':
      return [{ d: ridge(r, 330, 120, 14).d, depth: 0 }, { d: pines(r, 430, 60, 90, 170).d, depth: 1 }, { d: pines(r, 540, 14, 200, 330).d, depth: 2 }]
    case 'mountain': {
      const far = ridge(r, 260, 200, 10)
      return [{ d: far.d, caps: snowcaps(far.peaks), depth: 0 }, { d: ridge(r, 380, 170, 12).d, depth: 1 }, { d: hills(r, 520, 60), depth: 2 }]
    }
    case 'snow': {
      const far = ridge(r, 300, 180, 12)
      const near = pines(r, 500, 26, 110, 210, true)
      return [{ d: far.d, caps: snowcaps(far.peaks), depth: 0 }, { d: near.d, caps: near.caps, depth: 1 }, { d: hills(r, 560, 30), depth: 2 }]
    }
    case 'town':
    case 'tavern': {
      const t = town(r, 470)
      return [{ d: ridge(r, 340, 90, 10).d, depth: 0 }, { d: t.d, windows: t.windows, depth: 1 }, { d: hills(r, 560, 30), depth: 2 }]
    }
    case 'castle': {
      const c = castle(r, 450)
      return [{ d: ridge(r, 300, 130, 12).d, depth: 0 }, { d: c.d, windows: c.windows, depth: 1 }, { d: pines(r, 560, 10, 120, 220).d, depth: 2 }]
    }
    case 'temple':
      return [{ d: hills(r, 360, 80), depth: 0 }, { d: temple(r, 480), depth: 1 }, { d: hills(r, 570, 30), depth: 2 }]
    case 'dungeon':
      return [{ d: arches(r, 520, 4), depth: 1 }, { d: `M-60 560 H${W + 60} V${H} H-60Z`, depth: 2 }]
    case 'cave':
      return [{ d: stalactites(r, true, 26, 140), depth: 0 }, { d: stalactites(r, true, 14, 230) + stalactites(r, false, 18, 160), depth: 2 }]
    case 'crypt':
      return [{ d: hills(r, 380, 70), depth: 0 }, { d: graves(r, 480), depth: 1 }, { d: deadTrees(r, 580, 3), depth: 2 }]
    case 'swamp':
      return [{ d: pines(r, 380, 50, 60, 110).d, depth: 0 }, { d: deadTrees(r, 480, 6), depth: 1 }, { d: reeds(r, 560), depth: 2 }]
    case 'coast': {
      const c = cliff(r)
      return [{ d: `M-60 360 H${W + 60} V${H} H-60Z`, depth: 0 }, { d: c.d, light: c.light, depth: 1 }, { d: waves(500, 22), depth: 2, wave: true }]
    }
    case 'desert':
      return [{ d: `M900 330 L940 250 H1120 L1150 330Z M200 340 L230 290 H330 L350 340Z` + dunes(r, 380, 40), depth: 0 }, { d: dunes(r, 470, 70), depth: 1 }, { d: dunes(r, 560, 50), depth: 2 }]
    case 'road':
    default:
      return [{ d: ridge(r, 340, 110, 12).d, depth: 0 }, { d: hills(r, 450, 80), depth: 1 }, { d: `M560 600 L780 420 L820 420 L1040 600Z`, depth: 2 }, { d: hills(r, 590, 20), depth: 2 }]
  }
}

function hex(h: string) {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = hex(a)
  const [r2, g2, b2] = hex(b)
  return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`
}

const PARALLAX = [6, 14, 26]

export const Landscape = memo(function Landscape({ env, time, sky, seed = 7 }: { env: Environment; time: TimeOfDay; sky: [string, string]; seed?: number }) {
  const layers = useMemo(() => layersFor(env, seed + env.length * 13), [env, seed])
  const lit = time !== 'day' || env === 'tavern'
  const fills = [mix(sky[0], '#ffffff', 0.06), mix(sky[0], '#000000', 0.45), mix(sky[1], '#000000', 0.55)]
  const snow = env === 'snow' || env === 'mountain'

  return (
    <div className="absolute inset-x-0 bottom-0 h-[62vh] min-h-[320px]">
      {layers.map((l, i) => (
        <svg
          key={i}
          className={`landscape-layer absolute inset-0 h-full ${l.wave ? 'w-[200%]' : 'w-full'}`}
          viewBox={`0 0 ${l.wave ? W * 2 : W} ${H}`}
          preserveAspectRatio="xMidYMax slice"
          style={{
            transform: `translate3d(calc(var(--mx, 0) * ${-PARALLAX[l.depth]}px), calc(var(--my, 0) * ${-PARALLAX[l.depth] / 3}px), 0)`,
            animation: l.wave ? 'drift-x 26s linear infinite' : env === 'forest' && l.depth === 2 ? 'sway 9s ease-in-out infinite' : undefined,
            transformOrigin: 'bottom',
          }}
          aria-hidden
        >
          <path d={l.d} fill={fills[l.depth]} stroke="var(--t-accent)" strokeOpacity={l.depth === 2 ? 0.08 : 0.04} strokeWidth="1.5" />
          {l.caps && <path d={l.caps} fill={snow ? '#e2e8f0' : '#cbd5e1'} opacity={0.55 - l.depth * 0.1} />}
          {lit &&
            l.windows?.map(([x, y], k) => (
              <rect key={k} x={x} y={y} width="9" height="13" rx="1.5" fill="#fbbf24" opacity={0.85} style={{ filter: 'drop-shadow(0 0 6px #f59e0b)' }}>
                <animate attributeName="opacity" values="0.85;0.55;0.85" dur={`${3 + (k % 4)}s`} repeatCount="indefinite" />
              </rect>
            ))}
          {l.light && (
            <circle cx={l.light[0]} cy={l.light[1]} r="10" fill="#fde68a" style={{ filter: 'drop-shadow(0 0 18px #fde68a)' }}>
              <animate attributeName="opacity" values="1;0.2;1" dur="4s" repeatCount="indefinite" />
            </circle>
          )}
        </svg>
      ))}
    </div>
  )
})
