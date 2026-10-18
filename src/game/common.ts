import { gainXp } from '../engine/character'
import type { Campaign, Quest } from '../engine/types'
import type { StoryContext } from '../llm/context'
import { analyzeScene, summarizeStory, type SceneUpdate } from '../llm/director'
import { recentLog } from '../llm/context'
import { useGame } from '../store/game'

export const get = () => useGame.getState()
export const setStatus = (status: string) => useGame.setState({ status })
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const player = () => get().party.find((p) => p.isPlayer)!

const XP_OBJECTIVE = 50
const XP_QUEST = 150
const SUMMARY_EVERY = 6
const MAX_FACTS = 24
const MIN_TURNS_PER_ACT = 3

export function ctx(): StoryContext {
  const { premise, summary, facts, location, party, log, campaign, combat } = get()
  return { premise, summary, facts, location, party, log, campaign, combat }
}

export async function runExclusive(fn: () => Promise<void>) {
  if (get().busy) return
  useGame.setState({ busy: true })
  try {
    await fn()
  } catch (err) {
    console.error(err)
    get().addLog({ kind: 'system', text: `⚠️ ${err instanceof Error ? err.message : String(err)}` })
  } finally {
    useGame.setState({ busy: false, status: '' })
  }
}

export async function streamNarration(run: (onText: (t: string) => void) => Promise<string>): Promise<string> {
  const id = get().addLog({ kind: 'narration', text: '' })
  return run((t) => get().setNarration(id, t))
}

export function lastNarration(): string {
  for (const e of [...get().log].reverse()) if (e.kind === 'narration' && e.text) return e.text
  return ''
}

/** Gives every party member XP and announces level-ups. */
export function awardXp(amount: number) {
  for (const member of get().party) {
    const { character, levelsGained } = gainXp(member, amount)
    get().updateCharacter(member.id, () => character)
    for (const lv of levelsGained) {
      get().addLog({ kind: 'system', text: `🎉 ${member.name} reaches level ${lv}! (+${character.maxHp - member.maxHp} max HP)` })
    }
  }
}

const words = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter((w) => w.length > 2))

/** Loose match for LLM echoes of names/objectives ("the Old Mill" vs "Old Mill"). */
export function similar(a: string, b: string): boolean {
  const la = a.toLowerCase().trim()
  const lb = b.toLowerCase().trim()
  if (!la || !lb) return false
  if (la.includes(lb) || lb.includes(la)) return true
  const wa = words(a)
  const wb = words(b)
  const overlap = [...wa].filter((w) => wb.has(w)).length
  return overlap / Math.max(1, Math.min(wa.size, wb.size)) >= 0.6
}

function applyCampaignUpdates(c: Campaign, scene: SceneUpdate, turn: number, location: string) {
  const announcements: string[] = []
  let xp = 0

  const npcs = c.npcs.map((n) => {
    if (!n.met && scene.npcsMet.some((m) => similar(m, n.name))) {
      announcements.push(`🤝 You met ${n.name}, ${n.role}.`)
      return { ...n, met: true }
    }
    return n
  })
  for (const n of scene.newNpcs.slice(0, 2)) {
    if (n.name.trim() && !npcs.some((x) => similar(x.name, n.name))) npcs.push({ ...n, secret: '', met: true })
  }

  const locations = c.locations.map((l) => (!l.visited && similar(l.name, location) ? { ...l, visited: true } : l))

  let quests: Quest[] = c.quests.map((q) => {
    if (q.status !== 'active') return q
    const objectives = q.objectives.map((o) => {
      if (!o.done && scene.completedObjectives.some((done) => similar(done, o.text))) {
        announcements.push(`📜 Objective complete: ${o.text} (+${XP_OBJECTIVE} XP)`)
        xp += XP_OBJECTIVE
        return { ...o, done: true }
      }
      return o
    })
    const completed = objectives.every((o) => o.done)
    if (completed) {
      announcements.push(`🏆 Quest completed: ${q.title}! (+${XP_QUEST} XP)`)
      xp += XP_QUEST
    }
    return { ...q, objectives, status: completed ? 'completed' : 'active' }
  })
  for (const sq of scene.newSideQuests.slice(0, 1)) {
    if (sq.title.trim() && !quests.some((q) => similar(q.title, sq.title)) && quests.filter((q) => q.status === 'active').length < 4) {
      announcements.push(`📌 New quest: ${sq.title}`)
      quests = [...quests, { id: crypto.randomUUID(), title: sq.title, description: sq.description, status: 'active', main: false, objectives: sq.objectives.slice(0, 3).map((text) => ({ text, done: false })) }]
    }
  }

  let { currentAct, actStartedTurn } = c
  if (scene.beatCompleted && currentAct < c.acts.length - 1 && turn - actStartedTurn >= MIN_TURNS_PER_ACT) {
    currentAct++
    actStartedTurn = turn
    announcements.push(`📖 Chapter ${currentAct + 1} begins.`)
  }

  return { campaign: { ...c, npcs, locations, quests, currentAct, actStartedTurn }, announcements, xp }
}

/** Director pass after each narration: choices, location, journal, quests, pacing. */
export async function updateScene(narration: string): Promise<SceneUpdate> {
  setStatus('The story unfolds…')
  const scene = await analyzeScene(get().settings.directorModel, ctx(), narration)
  const s = get()
  const known = new Set(s.facts.map((f) => f.toLowerCase()))
  const fresh = scene.newFacts.filter((f) => f.trim() && !known.has(f.toLowerCase()))
  const location = scene.location || s.location
  const update = s.campaign ? applyCampaignUpdates(s.campaign, scene, s.turn, location) : null
  useGame.setState({
    choices: scene.choices,
    location,
    facts: [...s.facts, ...fresh].slice(-MAX_FACTS),
    ...(update ? { campaign: update.campaign } : {}),
  })
  for (const a of update?.announcements ?? []) get().addLog({ kind: 'system', text: a })
  if (update?.xp) awardXp(update.xp)
  return scene
}

export async function maybeSummarize() {
  const { turn, settings, summary, log } = get()
  if (turn === 0 || turn % SUMMARY_EVERY !== 0) return
  setStatus('The chronicler updates the tale…')
  const next = await summarizeStory(settings.directorModel, summary, recentLog(log, 24))
  useGame.setState({ summary: next })
}
