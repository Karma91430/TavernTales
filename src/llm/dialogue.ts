// Splits narrator text into narration paragraphs and spoken lines.
// Preferred format is `Name: "…"` on its own line; quotes left inside
// paragraphs are pulled out when the speaker can be identified safely.

export type Segment =
  | { kind: 'narration'; text: string }
  | { kind: 'speech'; speaker: string; manner?: string; text: string }

const SPEECH = /^\s*[-*•>]*\s*\**\s*([A-Z][\p{L}'’.\- ]{0,40}?)\s*\**\s*(?:\(([^)]{1,48})\))?\s*\**\s*[:：]\s*\**\s*(.+?)\s*$/u
const QUOTE_START = /^["“«'‘]/
const INLINE_QUOTE = /[“"]([^”"]{8,}?)[”"]/g
const SAY = '(?:says|said|whispers|whispered|mutters|muttered|growls|growled|replies|replied|asks|asked|adds|added|murmurs|murmured|shouts|shouted|calls|called|snaps|snapped|hisses|hissed|laughs|laughed|grumbles|grumbled|sighs|sighed|answers|answered|warns|warned|insists|insisted)'
const ATTRIBUTION = new RegExp(`^[,.!?—–-]*\\s*(?:(?:he|she|they|it|[A-Z][\\p{L}'’-]+(?:\\s+[A-Z][\\p{L}'’-]+)?)\\s+${SAY}|${SAY}\\s+(?:he|she|they|[A-Z][\\p{L}'’-]+))([^.!?]*)[.!?]?\\s*`, 'u')
const STOP = new Set(['The', 'A', 'An', 'You', 'Your', 'It', 'He', 'She', 'They', 'This', 'That', 'Then', 'As', 'In', 'With', 'But', 'And', 'Somewhere', 'Behind', 'Above', 'Outside', 'Inside', 'Suddenly', 'Finally', 'Now', 'Here', 'There', 'When', 'While', 'Before', 'After'])

function stripQuotes(t: string) {
  return t.replace(/^["“«'‘]+/, '').replace(/["”»'’]+$/, '').trim()
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Who is speaking, judging from the text right before (or after) a quote. */
function findSpeaker(before: string, after: string, known: string[], lastSpeaker?: string): string | undefined {
  const lower = before.toLowerCase()
  // 1. the last known name mentioned before the quote
  let best: { name: string; at: number } | undefined
  for (const n of known) {
    const at = Math.max(lower.lastIndexOf(n.toLowerCase()), lower.lastIndexOf(n.split(' ')[0].toLowerCase() + ' '))
    if (at >= 0 && (!best || at > best.at)) best = { name: n, at }
  }
  if (best) return best.name
  // 2. "Name says" right after the quote
  const named = after.match(new RegExp(`^[,.!?—–-]*\\s*(?:${SAY}\\s+)?([A-Z][\\p{L}'’-]+(?:\\s+[A-Z][\\p{L}'’-]+)?)(?:\\s+${SAY})?`, 'u'))
  if (named && !STOP.has(named[1].split(' ')[0])) return named[1]
  // 3. the subject of the sentence leading to the quote
  const sentence = before.split(/(?<=[.!?])\s+/).filter(Boolean).at(-1)?.trim() ?? ''
  const proper = sentence.match(/^([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){0,2})\b/u)
  if (proper && !STOP.has(proper[1].split(' ')[0])) return proper[1]
  const described = sentence.match(/^(?:A|An|The)\s+([a-z][a-z-]+(?:\s+[a-z][a-z-]+){0,2}?)(?=,|\s+(?:steps|leans|turns|looks|raises|nods|smiles|speaks|stands|sits|glances|grins|frowns|says|whispers|mutters|growls|calls))/)
  if (described) return cap(described[1])
  // 4. a pronoun continuing the previous speaker
  if (lastSpeaker && /^[,.!?—–-]*\s*(he|she|they)\s/i.test(after)) return lastSpeaker
  return undefined
}

function splitInline(paragraph: string, known: string[], lastSpeaker: string | undefined): Segment[] {
  const out: Segment[] = []
  let cursor = 0
  let speaker = lastSpeaker
  for (const m of paragraph.matchAll(INLINE_QUOTE)) {
    const start = m.index ?? 0
    const before = paragraph.slice(cursor, start)
    const after = paragraph.slice(start + m[0].length)
    // A quote right after the previous one (only "he says" in between) continues the same speaker.
    const who = !before.trim() && speaker && out.at(-1)?.kind === 'speech' ? speaker : findSpeaker(paragraph.slice(0, start), after, known, speaker)
    if (!who) continue
    const lead = before.trim()
    if (lead) out.push({ kind: 'narration', text: lead })
    const attribution = after.match(ATTRIBUTION)
    const manner = attribution?.[1]?.replace(/^[\s,]+/, '').trim()
    out.push({ kind: 'speech', speaker: who, manner: manner && manner.length < 40 ? manner : undefined, text: m[1].trim().replace(/[,]$/, '') })
    cursor = start + m[0].length + (attribution?.[0].length ?? 0)
    speaker = who
  }
  const rest = paragraph.slice(cursor).trim()
  if (rest) out.push({ kind: 'narration', text: rest })
  return out
}

export function parseNarration(text: string, knownNames: string[]): Segment[] {
  const known = knownNames.map((n) => n.toLowerCase())
  const isKnown = (name: string) => {
    const l = name.toLowerCase()
    return known.some((k) => k === l || k.split(' ')[0] === l || l.split(' ')[0] === k.split(' ')[0])
  }
  const segments: Segment[] = []
  let buffer: string[] = []
  const lastSpeaker = () => [...segments].reverse().find((s) => s.kind === 'speech') as { speaker: string } | undefined
  const flush = () => {
    const t = buffer.join('\n').trim()
    buffer = []
    if (!t) return
    for (const para of t.split(/\n\s*\n/)) {
      const parts = splitInline(para.trim(), knownNames, lastSpeaker()?.speaker)
      // Merge consecutive narration so paragraphs stay together.
      for (const p of parts) {
        const prev = segments.at(-1)
        if (p.kind === 'narration' && prev?.kind === 'narration') prev.text += `\n\n${p.text}`
        else if (p.kind === 'speech' && prev?.kind === 'speech' && prev.speaker === p.speaker) prev.text += `${/[.!?…]$/.test(prev.text) ? '' : /^[A-Z]/.test(p.text) ? '.' : ','} ${p.text}`
        else segments.push(p)
      }
    }
  }
  for (const line of text.split('\n')) {
    const m = line.match(SPEECH)
    if (m && m[3] && (QUOTE_START.test(m[3]) || isKnown(m[1])) && m[1].split(' ').length <= 4) {
      flush()
      segments.push({ kind: 'speech', speaker: m[1].trim(), manner: m[2]?.trim(), text: stripQuotes(m[3].replace(/\*+/g, '')) })
    } else {
      buffer.push(line)
    }
  }
  flush()
  return segments
}
