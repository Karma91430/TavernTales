import { useRef, useState } from 'react'
import { deleteSlot, exportGame, importGame, listSlots, loadSlot, saveToSlot } from '../../store/saves'
import { useGame } from '../../store/game'
import { Button, Modal, selectCls } from '../ui'

export function Saves() {
  const { openMenu, campaign, busy, newGame } = useGame()
  const [slots, setSlots] = useState(listSlots)
  const [name, setName] = useState(campaign?.title ?? 'My adventure')
  const [message, setMessage] = useState('')
  const [confirmNew, setConfirmNew] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const refresh = () => setSlots(listSlots())

  return (
    <Modal title="Saves" onClose={() => openMenu(null)}>
      <p className="mb-3 text-sm text-stone-400">Your current game auto-saves in this browser. Save slots let you keep several adventures or checkpoints.</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          saveToSlot(name.trim() || 'Untitled')
          refresh()
          setMessage('Saved.')
        }}
      >
        <input className={selectCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Save name" />
        <Button type="submit" disabled={busy}>Save</Button>
      </form>
      {message && <p className="mt-2 text-sm text-emerald-300">{message}</p>}

      <div className="mt-4 space-y-2">
        {slots.length === 0 && <p className="text-stone-500">No save slots yet.</p>}
        {slots.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-800 bg-stone-950/50 px-3 py-2">
            <div className="min-w-0">
              <div className="text-stone-100">{s.name}</div>
              <div className="truncate text-sm text-stone-400">{s.subtitle} · {new Date(s.savedAt).toLocaleString()}</div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" disabled={busy} onClick={() => { loadSlot(s.id); openMenu(null) }}>Load</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => { saveToSlot(s.name, s.id); refresh(); setMessage(`Overwrote “${s.name}”.`) }}>Overwrite</Button>
              <Button size="sm" variant="danger" onClick={() => { deleteSlot(s.id); refresh() }}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-stone-800 pt-4">
        <Button variant="ghost" onClick={exportGame}>⬇️ Export to file</Button>
        <Button variant="ghost" onClick={() => file.current?.click()}>⬆️ Import from file</Button>
        <input
          ref={file}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              await importGame(f)
              openMenu(null)
            } catch (err) {
              setMessage(err instanceof Error ? err.message : String(err))
            }
          }}
        />
        <div className="flex-1" />
        {confirmNew ? (
          <>
            <span className="self-center text-sm text-rose-300">Abandon this adventure?</span>
            <Button variant="danger" onClick={newGame}>Yes, new game</Button>
            <Button variant="ghost" onClick={() => setConfirmNew(false)}>No</Button>
          </>
        ) : (
          <Button variant="danger" onClick={() => setConfirmNew(true)}>New game</Button>
        )}
      </div>
    </Modal>
  )
}
