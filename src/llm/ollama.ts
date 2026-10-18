const BASE = '/ollama'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function listModels(): Promise<string[]> {
  const res = await fetch(`${BASE}/api/tags`)
  if (!res.ok) throw new Error(`Ollama unreachable (${res.status})`)
  const data = (await res.json()) as { models: { name: string }[] }
  return data.models.map((m) => m.name).filter((n) => !n.includes('embedding'))
}

// Some models reject the `think` flag; remember which ones so we only retry once.
const noThinkFlag = new Set<string>()

async function post(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const model = body.model as string
  const payload = noThinkFlag.has(model) ? body : { ...body, think: false }
  let res = await fetch(`${BASE}/api/chat`, { method: 'POST', body: JSON.stringify(payload), signal })
  if (res.status === 400 && !noThinkFlag.has(model)) {
    const text = await res.text()
    if (!text.includes('think')) throw new Error(`Ollama error: ${text}`)
    noThinkFlag.add(model)
    res = await fetch(`${BASE}/api/chat`, { method: 'POST', body: JSON.stringify(body), signal })
  }
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`)
  return res
}

const stripThinking = (s: string) => s.replace(/<think>[\s\S]*?(<\/think>|$)/g, '')

/** Structured output: Ollama constrains generation to the JSON schema. */
export async function chatJson<T>(
  model: string,
  messages: ChatMessage[],
  schema: object,
  temperature = 0.3,
): Promise<T> {
  const res = await post({ model, messages, format: schema, stream: false, options: { temperature } })
  const data = (await res.json()) as { message: { content: string } }
  return JSON.parse(stripThinking(data.message.content)) as T
}

/** Streams the reply, calling onText with the full text so far. */
export async function chatStream(
  model: string,
  messages: ChatMessage[],
  onText: (fullText: string) => void,
  temperature = 0.85,
): Promise<string> {
  const res = await post({ model, messages, stream: true, options: { temperature, num_ctx: 8192 } })
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let raw = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()!
    for (const line of lines) {
      if (!line.trim()) continue
      const chunk = JSON.parse(line) as { message?: { content?: string } }
      raw += chunk.message?.content ?? ''
      onText(stripThinking(raw).trimStart())
    }
  }
  return stripThinking(raw).trim()
}
