import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, type CSSProperties } from 'react'
import { Landscape } from './Landscape'
import { skinForTone, type SkinId } from '../theme/skins'
import type { Environment, TimeOfDay } from '../engine/types'
import { useGame } from '../store/game'

interface Particles {
  kind: 'rise' | 'fall' | 'drift' | 'float'
  count: number
  color: string
  size: [number, number]
  duration: [number, number]
  glow?: boolean
  streak?: boolean
}

interface EnvInfo {
  icon: string
  label: string
  sky: [string, string]
  outdoor: boolean
  particles?: (time: TimeOfDay) => Particles | undefined
  fog?: string
  rays?: string
}

const embers: Particles = { kind: 'rise', count: 26, color: '#fb923c', size: [2, 4], duration: [6, 12], glow: true }
const dust = (color = '#d6d3d1'): Particles => ({ kind: 'float', count: 18, color, size: [1, 3], duration: [8, 16] })
const fireflies = (color = '#d9f99d'): Particles => ({ kind: 'float', count: 22, color, size: [2, 4], duration: [5, 10], glow: true })
const snow: Particles = { kind: 'fall', count: 60, color: '#f8fafc', size: [2, 5], duration: [8, 16] }

export const ENV_INFO: Record<Environment, EnvInfo> = {
  town: { icon: '🏘️', label: 'Town', sky: ['#2b2118', '#0c0a09'], outdoor: true, particles: (t) => (t === 'night' ? fireflies('#fde68a') : dust('#e7e5e4')) },
  tavern: { icon: '🍺', label: 'Tavern', sky: ['#3d2010', '#0c0807'], outdoor: false, particles: () => embers },
  forest: {
    icon: '🌲',
    label: 'Forest',
    sky: ['#13261a', '#060c08'],
    outdoor: true,
    particles: (t) => (t === 'day' ? { kind: 'fall', count: 18, color: '#a3a33a', size: [3, 6], duration: [10, 18] } : fireflies()),
    rays: 'rgba(190, 242, 100, 0.10)',
  },
  dungeon: { icon: '🗝️', label: 'Dungeon', sky: ['#1c1c22', '#050507'], outdoor: false, particles: () => dust('#a8a29e') },
  cave: { icon: '🕳️', label: 'Cave', sky: ['#18202a', '#040506'], outdoor: false, particles: () => ({ kind: 'fall', count: 12, color: '#7dd3fc', size: [1, 2], duration: [2, 4], streak: true }) },
  crypt: { icon: '⚰️', label: 'Crypt', sky: ['#121a15', '#030504'], outdoor: false, particles: () => fireflies('#86efac'), fog: 'rgba(134, 239, 172, 0.10)' },
  castle: { icon: '🏰', label: 'Castle', sky: ['#24203a', '#08070d'], outdoor: false, particles: () => dust('#c4b5fd'), rays: 'rgba(196, 181, 253, 0.10)' },
  temple: { icon: '⛩️', label: 'Temple', sky: ['#2c2614', '#0b0905'], outdoor: false, particles: () => dust('#fde68a'), rays: 'rgba(253, 230, 138, 0.14)' },
  coast: { icon: '🌊', label: 'Coast', sky: ['#0e2533', '#04090d'], outdoor: true, particles: () => ({ kind: 'drift', count: 30, color: '#e0f2fe', size: [1, 3], duration: [6, 12] }), fog: 'rgba(224, 242, 254, 0.06)' },
  mountain: { icon: '⛰️', label: 'Mountains', sky: ['#1d2533', '#07090d'], outdoor: true, particles: () => ({ kind: 'drift', count: 24, color: '#f1f5f9', size: [1, 2], duration: [3, 6], streak: true }) },
  swamp: { icon: '🐸', label: 'Swamp', sky: ['#18220f', '#050703'], outdoor: true, particles: () => fireflies('#bef264'), fog: 'rgba(190, 242, 100, 0.10)' },
  snow: { icon: '❄️', label: 'Snowfields', sky: ['#1f2b38', '#090d12'], outdoor: true, particles: () => snow },
  desert: { icon: '🏜️', label: 'Desert', sky: ['#3d2b12', '#110b04'], outdoor: true, particles: () => ({ kind: 'drift', count: 50, color: '#fdba74', size: [1, 2], duration: [3, 7] }) },
  road: { icon: '🛤️', label: 'The Road', sky: ['#23261a', '#0a0b07'], outdoor: true, particles: (t) => (t === 'night' ? fireflies('#fef08a') : { kind: 'drift', count: 14, color: '#d6d3d1', size: [1, 3], duration: [8, 14] }) },
}

// Deterministic pseudo-random so particles don't jump on re-render.
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function ParticleField({ p }: { p: Particles }) {
  const items = useMemo(
    () =>
      Array.from({ length: p.count }, (_, i) => {
        const r = (k: number) => rand(i * 7 + k)
        const size = p.size[0] + r(1) * (p.size[1] - p.size[0])
        const duration = p.duration[0] + r(2) * (p.duration[1] - p.duration[0])
        const style = {
          left: p.kind === 'drift' ? 0 : `${r(3) * 100}%`,
          top: p.kind === 'rise' ? '100%' : p.kind === 'fall' ? 0 : `${r(4) * 100}%`,
          width: p.streak ? 1 : size,
          height: p.streak ? size * 6 : size,
          background: p.color,
          borderRadius: p.streak ? 1 : '50%',
          boxShadow: p.glow ? `0 0 ${size * 3}px ${size}px ${p.color}` : undefined,
          animation: `p-${p.kind} ${duration}s ${p.kind === 'float' ? 'ease-in-out' : 'linear'} ${-r(5) * duration}s infinite`,
          '--sway': `${(r(6) - 0.5) * 120}px`,
        } as CSSProperties
        return style
      }),
    [p],
  )
  return (
    <>
      {items.map((style, i) => (
        <span key={i} className="particle absolute" style={style} />
      ))}
    </>
  )
}

function Stars() {
  const stars = useMemo(
    () => Array.from({ length: 70 }, (_, i) => ({ left: `${rand(i) * 100}%`, top: `${rand(i + 100) * 55}%`, delay: `${rand(i + 200) * 4}s`, size: rand(i + 300) > 0.85 ? 2 : 1 })),
    [],
  )
  return (
    <>
      {stars.map((s, i) => (
        <span key={i} className="particle absolute rounded-full bg-white" style={{ left: s.left, top: s.top, width: s.size, height: s.size, animation: `twinkle 4s ease-in-out ${s.delay} infinite` }} />
      ))}
    </>
  )
}

/** Mouse position → --mx/--my in [-1, 1] for parallax layers. */
function useParallax() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--mx', ((e.clientX / innerWidth) * 2 - 1).toFixed(3))
        document.documentElement.style.setProperty('--my', ((e.clientY / innerHeight) * 2 - 1).toFixed(3))
      })
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])
}

export function Scenery() {
  const environment = useGame((s) => s.environment)
  const timeOfDay = useGame((s) => s.timeOfDay)
  const phase = useGame((s) => (s.atTitle ? 'title' : s.phase))
  useParallax()
  const skin = useGame((s) => (s.settings.skin === 'auto' ? skinForTone(s.campaign?.tone ?? s.tone) : s.settings.skin))
  // Menus show the skin's signature landscape; the game shows wherever the party actually is.
  const inGame = phase === 'playing'
  const [menuEnv, menuTime] = MENU_SCENE[skin]
  const env: Environment = inGame ? environment : menuEnv
  const time: TimeOfDay = inGame ? timeOfDay : menuTime
  const info = ENV_INFO[env] ?? ENV_INFO.town
  const particles = inGame || skin !== 'heroic' ? info.particles?.(time) : embersMenu
  const key = `${env}-${time}`

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <AnimatePresence>
        <motion.div key={key} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.6 }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 0%, ${info.sky[0]}, ${info.sky[1]} 80%)` }} />
          {/* skin tint so every theme colors the world a little */}
          <div className="absolute inset-0 mix-blend-soft-light" style={{ background: 'radial-gradient(ellipse at 50% 30%, color-mix(in oklab, var(--t-accent) 35%, transparent), transparent 70%)' }} />
          {info.outdoor && time === 'night' && <Stars />}
          {time === 'night' && <div className="absolute inset-0 bg-indigo-950/40" />}
          {time === 'dusk' && <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(249, 115, 22, 0.16), rgba(88, 28, 135, 0.14) 45%, transparent 75%)' }} />}
          {time !== 'night' && info.outdoor && (
            <div className="absolute left-1/2 top-[22%] h-40 w-40 -translate-x-1/2 rounded-full blur-2xl" style={{ background: time === 'dusk' ? 'rgba(251,146,60,0.35)' : 'rgba(254,243,199,0.18)' }} />
          )}
          {info.rays && time !== 'night' && (
            <div className="absolute -top-1/4 left-1/4 h-[150%] w-1/2 origin-top blur-2xl" style={{ background: `linear-gradient(to bottom, ${info.rays}, transparent 70%)`, clipPath: 'polygon(35% 0, 65% 0, 100% 100%, 0 100%)', animation: 'rays 12s ease-in-out infinite' }} />
          )}
          <Landscape env={env} time={time} sky={info.sky} />
          {info.fog && (
            <div className="absolute inset-x-[-30%] bottom-0 h-1/2 blur-3xl" style={{ background: `radial-gradient(ellipse at 30% 80%, ${info.fog}, transparent 60%), radial-gradient(ellipse at 70% 90%, ${info.fog}, transparent 55%)`, animation: 'fog 40s ease-in-out infinite alternate' }} />
          )}
          {particles && <ParticleField p={particles} />}
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55))' }} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

const MENU_SCENE: Record<SkinId, [Environment, TimeOfDay]> = {
  heroic: ['castle', 'dusk'],
  grim: ['mountain', 'night'],
  bright: ['forest', 'day'],
  mystery: ['temple', 'night'],
  horror: ['crypt', 'night'],
  sea: ['coast', 'dusk'],
}

const embersMenu: Particles = { kind: 'rise', count: 22, color: '#fb923c', size: [2, 4], duration: [8, 14], glow: true }
