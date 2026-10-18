import { useMemo } from 'react'
import type { Character } from '../engine/types'
import { useGame } from '../store/game'
import { CLASS_COLOR, Medallion } from './Portrait'

export interface Speaker {
  name: string
  color: string
  subtitle?: string
  character?: Character
  isPlayer?: boolean
  icon?: string
}

const NPC_COLORS = ['#0ea5e9', '#14b8a6', '#a855f7', '#f97316', '#84cc16', '#e11d48', '#6366f1', '#eab308', '#06b6d4', '#ec4899']

const ROLE_ICONS: [RegExp, string][] = [
  [/inn|tavern|bar(keep|maid)/i, '🍺'],
  [/guard|soldier|captain|knight/i, '🛡️'],
  [/merchant|trader|shop|peddler/i, '💰'],
  [/wizard|mage|sorcer|witch|arcan/i, '🔮'],
  [/priest|cleric|monk|nun|acolyte/i, '🕯️'],
  [/librar|scholar|sage|scribe/i, '📚'],
  [/thief|rogue|smuggl|spy/i, '🗝️'],
  [/noble|lord|lady|king|queen|prince|duke|mayor/i, '👑'],
  [/child|girl|boy|orphan/i, '🧒'],
  [/hunter|ranger|trapper/i, '🏹'],
  [/sailor|pirate|captain/i, '⚓'],
  [/villain|cult|antagonist|dark/i, '😈'],
  [/farmer|miller|villager|peasant/i, '🌾'],
  [/smith|forge/i, '⚒️'],
]

function hash(s: string) {
  let h = 0
  for (const c of s.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

/** Lightens a hex color, for readable names on dark bubbles. */
export function tint(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * t))
  return `rgb(${ch.join(',')})`
}

const sameName = (a: string, b: string) => {
  const x = a.toLowerCase().trim()
  const y = b.toLowerCase().trim()
  return x === y || x.split(' ')[0] === y.split(' ')[0]
}

/** Resolves who is talking: a party member, a known NPC, or a passer-by. */
export function useSpeakers() {
  const party = useGame((s) => s.party)
  const npcs = useGame((s) => s.campaign?.npcs)
  return useMemo(() => {
    const names = [...party.map((p) => p.name), ...(npcs ?? []).map((n) => n.name)]
    const resolve = (name: string): Speaker => {
      const member = party.find((p) => sameName(p.name, name))
      if (member) {
        return {
          name: member.name,
          color: CLASS_COLOR[member.className]?.[0] ?? '#a8a29e',
          subtitle: member.isPlayer ? undefined : `${member.race} ${member.className}`,
          character: member,
          isPlayer: member.isPlayer,
        }
      }
      const npc = npcs?.find((n) => sameName(n.name, name))
      const role = npc?.role ?? ''
      return {
        name,
        color: NPC_COLORS[hash(name) % NPC_COLORS.length],
        subtitle: role || undefined,
        icon: ROLE_ICONS.find(([re]) => re.test(`${role} ${name}`))?.[1],
      }
    }
    return { names, resolve }
  }, [party, npcs])
}

export function SpeakerAvatar({ s, size = 38 }: { s: Speaker; size?: number }) {
  if (s.character) return <Medallion c={s.character} size={size} />
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: s.icon ? size * 0.5 : size * 0.42, background: `radial-gradient(circle at 35% 30%, ${tint(s.color, 0.25)}, ${s.color} 60%, #0008)`, boxShadow: 'inset 0 -4px 10px rgba(0,0,0,0.45)' }}
    >
      {s.icon ?? s.name.charAt(0)}
    </div>
  )
}
