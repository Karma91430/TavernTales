import { useGame, type Cinematic, type Fx } from './game'

// Transient presentation helpers: the game logic fires these, the UI animates them.

const FX_MS = 1500

export function pushFx(targetId: string, text: string, tone: Fx['tone']) {
  const id = crypto.randomUUID()
  useGame.setState((s) => ({ fx: [...s.fx, { id, targetId, text, tone }] }))
  setTimeout(() => useGame.setState((s) => ({ fx: s.fx.filter((f) => f.id !== id) })), FX_MS)
}

const cinematicResolvers = new Map<string, () => void>()

/** Queues a full-screen moment. The promise resolves once it has been shown. */
export function playCinematic(c: Omit<Cinematic, 'id'>): Promise<void> {
  const id = crypto.randomUUID()
  const fast = useGame.getState().settings.diceSpeed === 'fast'
  return new Promise((resolve) => {
    cinematicResolvers.set(id, resolve)
    useGame.setState((s) => ({ cinematics: [...s.cinematics, { ...c, id, duration: fast ? c.duration * 0.6 : c.duration }] }))
  })
}

export function finishCinematic(id: string) {
  useGame.setState((s) => ({ cinematics: s.cinematics.filter((c) => c.id !== id) }))
  cinematicResolvers.get(id)?.()
  cinematicResolvers.delete(id)
}

let finisherResolver: ((how: string) => void) | null = null

/** "How do you want to do this?" — waits for the player to describe the killing blow. */
export function askFinisher(f: NonNullable<ReturnType<typeof useGame.getState>['finisher']>): Promise<string> {
  return new Promise((resolve) => {
    finisherResolver = resolve
    useGame.setState({ finisher: f })
  })
}

export function answerFinisher(how: string) {
  useGame.setState({ finisher: null })
  finisherResolver?.(how)
  finisherResolver = null
}

let allyResolver: ((id: string | null) => void) | null = null

/** Lets the player click a party member on the battlefield (or cancel). */
export function pickAlly(prompt: string): Promise<string | null> {
  allyResolver?.(null)
  return new Promise((resolve) => {
    allyResolver = resolve
    useGame.setState({ allyPick: { prompt } })
  })
}

export function resolveAllyPick(id: string | null) {
  useGame.setState({ allyPick: null })
  allyResolver?.(id)
  allyResolver = null
}
