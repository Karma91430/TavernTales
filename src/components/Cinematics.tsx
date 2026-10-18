import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo } from 'react'
import { finishCinematic } from '../store/fx'
import { useGame, type Cinematic } from '../store/game'

function Letterbox() {
  return (
    <>
      <motion.div className="absolute inset-x-0 top-0 h-[12vh] bg-black" initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }} />
      <motion.div className="absolute inset-x-0 bottom-0 h-[12vh] bg-black" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} />
    </>
  )
}

function Title({ c, color = 'text-amber-300', size = 'text-5xl sm:text-7xl' }: { c: Cinematic; color?: string; size?: string }) {
  return (
    <div className="relative text-center">
      <motion.h2
        className={`font-display ${size} ${color} drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)]`}
        initial={{ scale: 1.6, opacity: 0, letterSpacing: '0.5em' }}
        animate={{ scale: 1, opacity: 1, letterSpacing: '0.08em' }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        {c.title}
      </motion.h2>
      {c.subtitle && (
        <motion.p className="mt-3 text-xl italic text-stone-200 drop-shadow-[0_2px_8px_rgba(0,0,0,1)]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          {c.subtitle}
        </motion.p>
      )}
    </div>
  )
}

function Rays({ color }: { color: string }) {
  return (
    <div
      className="absolute left-1/2 top-1/2 h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2 opacity-40"
      style={{ background: `repeating-conic-gradient(${color} 0deg 6deg, transparent 6deg 18deg)`, animation: 'spin-slow 20s linear infinite', maskImage: 'radial-gradient(circle, black, transparent 45%)' }}
    />
  )
}

function Burst({ count = 24, color = '#fcd34d' }: { count?: number; color?: string }) {
  const sparks = useMemo(() => Array.from({ length: count }, (_, i) => ({ angle: (i / count) * Math.PI * 2, dist: 140 + Math.random() * 160 })), [count])
  return (
    <>
      {sparks.map((s, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
          style={{ background: color, boxShadow: `0 0 12px 3px ${color}` }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: Math.cos(s.angle) * s.dist, y: Math.sin(s.angle) * s.dist, opacity: 0 }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.2 }}
        />
      ))}
    </>
  )
}

function Campfire() {
  return (
    <div className="relative mx-auto h-32 w-32">
      <div className="absolute bottom-0 left-1/2 h-3 w-24 -translate-x-1/2 rounded-full bg-amber-950" />
      <div className="absolute bottom-1 left-1/2 h-2 w-20 -translate-x-1/2 rotate-12 rounded bg-yellow-900" />
      <div className="absolute bottom-1 left-1/2 h-2 w-20 -translate-x-1/2 -rotate-12 rounded bg-yellow-900" />
      {[
        { w: 56, h: 80, c: '#dc2626', d: '0s' },
        { w: 42, h: 64, c: '#f97316', d: '0.15s' },
        { w: 26, h: 44, c: '#facc15', d: '0.3s' },
      ].map((f, i) => (
        <div
          key={i}
          className="absolute bottom-3 left-1/2 origin-bottom blur-[1px]"
          style={{ width: f.w, height: f.h, marginLeft: -f.w / 2, background: f.c, borderRadius: '50% 50% 35% 35% / 65% 65% 35% 35%', animation: `flame 0.6s ease-in-out ${f.d} infinite`, boxShadow: `0 0 40px 10px ${f.c}55` }}
        />
      ))}
      <div className="absolute -inset-16 -z-10 rounded-full" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.35), transparent 65%)' }} />
    </div>
  )
}

function Scene({ c }: { c: Cinematic }) {
  switch (c.kind) {
    case 'battle':
      return (
        <>
          <motion.div className="absolute inset-0 bg-red-700" initial={{ opacity: 0.7 }} animate={{ opacity: 0 }} transition={{ duration: 0.6 }} />
          <div className="absolute inset-0 bg-black/60" />
          <Letterbox />
          <div className="relative flex flex-col items-center gap-4">
            <motion.div className="text-8xl" initial={{ scale: 4, rotate: -45, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
              {c.icon}
            </motion.div>
            <Title c={c} color="text-rose-300" />
          </div>
        </>
      )
    case 'boss':
      return (
        <>
          <div className="absolute inset-0 bg-black/85" />
          <motion.div className="absolute inset-0" style={{ background: 'radial-gradient(circle, rgba(185,28,28,0.5), transparent 60%)' }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.6 }} />
          <Letterbox />
          <div className="relative flex flex-col items-center gap-4">
            <motion.div className="text-9xl" initial={{ scale: 0.3, opacity: 0, filter: 'blur(12px)' }} animate={{ scale: [0.3, 1.15, 1], opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 1.1 }}>
              {c.icon}
            </motion.div>
            <Title c={{ ...c, title: `👑 ${c.title}` }} color="text-red-400" />
          </div>
        </>
      )
    case 'victory':
      return (
        <>
          <div className="absolute inset-0 bg-black/65" />
          <Rays color="rgba(251,191,36,0.5)" />
          <Burst />
          <div className="relative flex flex-col items-center gap-3">
            <motion.div className="text-8xl" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 200 }}>{c.icon}</motion.div>
            <Title c={c} />
          </div>
        </>
      )
    case 'defeat':
      return (
        <>
          <motion.div className="absolute inset-0 bg-black" initial={{ opacity: 0 }} animate={{ opacity: 0.85 }} transition={{ duration: 1 }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle, transparent 30%, rgba(127,29,29,0.7))' }} />
          <div className="relative flex flex-col items-center gap-3">
            <motion.div className="text-8xl grayscale" initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.2 }}>{c.icon}</motion.div>
            <Title c={c} color="text-red-500" />
          </div>
        </>
      )
    case 'flee':
      return (
        <>
          <div className="absolute inset-0 bg-black/50" />
          <motion.div className="relative" initial={{ x: '-60vw' }} animate={{ x: ['-60vw', '0vw', '0vw'] }} transition={{ duration: 0.7 }}>
            <div className="text-center text-7xl">{c.icon}</div>
            <Title c={c} color="text-sky-200" size="text-5xl" />
          </motion.div>
        </>
      )
    case 'levelup':
      return (
        <>
          <div className="absolute inset-0 bg-black/60" />
          <Rays color="rgba(253,224,71,0.55)" />
          <Burst count={32} />
          <motion.div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ boxShadow: '0 0 120px 60px rgba(250,204,21,0.45)' }} initial={{ scale: 0 }} animate={{ scale: [0, 1.6, 1] }} transition={{ duration: 0.9 }} />
          <div className="relative flex flex-col items-center gap-2">
            <motion.div className="text-7xl" animate={{ rotate: [0, 360] }} transition={{ duration: 1.2 }}>✨</motion.div>
            <p className="font-display text-lg uppercase tracking-[0.4em] text-amber-200">Level up</p>
            <Title c={c} color="text-yellow-300" />
          </div>
        </>
      )
    case 'quest':
      return (
        <>
          <div className="absolute inset-0 bg-black/55" />
          <motion.div
            className="relative max-w-xl rounded-sm px-10 py-8 text-center text-stone-900 shadow-2xl"
            style={{ background: 'linear-gradient(#e7d6aa, #d6c08a)', boxShadow: '0 20px 60px rgba(0,0,0,0.7), inset 0 0 40px rgba(120,80,20,0.35)' }}
            initial={{ scaleX: 0.05, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="text-5xl">{c.icon}</div>
            <h2 className="mt-2 font-display text-3xl text-amber-950">{c.title}</h2>
            {c.subtitle && <p className="mt-2 text-xl italic">{c.subtitle}</p>}
          </motion.div>
        </>
      )
    case 'chapter':
      return (
        <>
          <motion.div className="absolute inset-0 bg-black" initial={{ opacity: 0 }} animate={{ opacity: 0.95 }} transition={{ duration: 0.8 }} />
          <div className="relative text-center">
            <motion.div className="mx-auto mb-4 h-px w-64 bg-gradient-to-r from-transparent via-amber-500 to-transparent" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.4, duration: 0.8 }} />
            <Title c={c} color="text-amber-200" />
            <motion.div className="mx-auto mt-4 h-px w-64 bg-gradient-to-r from-transparent via-amber-500 to-transparent" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.4, duration: 0.8 }} />
          </div>
        </>
      )
    case 'short-rest':
      return (
        <>
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative flex flex-col items-center gap-4">
            <div className="relative h-24 w-16">
              <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden rounded-t-full border-2 border-amber-700/70">
                <div className="absolute inset-x-0 bottom-0 h-full origin-bottom bg-amber-400" style={{ animation: `sand ${c.duration}ms linear forwards` }} />
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-full border-2 border-amber-700/70" />
            </div>
            <Title c={c} color="text-amber-200" size="text-4xl sm:text-5xl" />
          </div>
        </>
      )
    case 'long-rest':
      return (
        <>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(#020617, #0f172a 70%, #1e1b4b)' }} />
          {/* Dawn breaks at the end, unless the night is interrupted. */}
          {!c.title.includes('restless') && (
            <motion.div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(#1e3a8a, #c2410c 75%, #fb923c)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0, 0.9] }}
              transition={{ duration: c.duration / 1000, times: [0, 0.6, 1] }}
            />
          )}
          {Array.from({ length: 50 }, (_, i) => (
            <span key={i} className="absolute rounded-full bg-white" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 50}%`, width: 2, height: 2, animation: `twinkle ${2 + (i % 3)}s ease-in-out ${(i % 5) * 0.3}s infinite` }} />
          ))}
          <div className="relative flex flex-col items-center gap-6">
            <div className="relative">
              <Campfire />
              {[0, 1, 2].map((i) => (
                <span key={i} className="absolute -right-6 top-0 font-display text-2xl text-sky-200" style={{ animation: `zzz 2.4s ease-out ${i * 0.8}s infinite` }}>z</span>
              ))}
            </div>
            <Title c={c} color="text-amber-100" size="text-4xl sm:text-5xl" />
          </div>
        </>
      )
    case 'item':
      return (
        <>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative flex flex-col items-center gap-3">
            <div className="relative text-7xl" style={{ animation: 'wiggle 0.5s ease-in-out 3' }}>
              {c.icon}
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="absolute left-1/2 top-0 h-3 w-3 rounded-full bg-emerald-300/80" style={{ marginLeft: (i - 4) * 8, animation: `bubble 1.2s ease-out ${i * 0.12}s infinite` }} />
              ))}
            </div>
            <Title c={c} color="text-emerald-200" size="text-3xl" />
          </div>
        </>
      )
    case 'location':
      return null
  }
}

/** Plays queued cinematics one at a time. Location titles are a non-blocking banner. */
export function Cinematics() {
  const current = useGame((s) => s.cinematics[0])

  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => finishCinematic(current.id), current.duration)
    return () => clearTimeout(t)
  }, [current])

  return (
    <AnimatePresence>
      {current && current.kind === 'location' && (
        <motion.div
          key={current.id}
          className="pointer-events-none fixed inset-x-0 top-20 z-30 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center">
            <div className="mx-auto h-px w-72 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
            <p className="px-6 py-2 font-display text-3xl tracking-wider text-amber-100 drop-shadow-[0_2px_10px_rgba(0,0,0,1)]">{current.title}</p>
            <div className="mx-auto h-px w-72 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
          </div>
        </motion.div>
      )}
      {current && current.kind !== 'location' && (
        <motion.div
          key={current.id}
          className="fixed inset-0 z-[60] flex cursor-pointer items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          onClick={() => finishCinematic(current.id)}
        >
          <Scene c={current} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
