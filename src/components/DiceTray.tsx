import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { rollFree } from '../game/loop'
import { useGame } from '../store/game'

const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100', '2d6']

/** Floating dice bag in the corner: free rolls for fun or table rulings. */
export function DiceTray() {
  const rolling = useGame((s) => s.pendingRoll !== null)
  const [open, setOpen] = useState(false)
  return (
    <div className="fixed bottom-4 left-4 z-30 flex flex-col-reverse items-start gap-2">
      <motion.button
        whileHover={{ rotate: 20, scale: 1.08 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-accent/60 bg-surface-2 text-2xl shadow-[0_0_20px_-4px_var(--t-accent)] backdrop-blur"
        title="Dice tray"
        aria-label="Dice tray"
      >
        🎲
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="panel grid grid-cols-4 gap-1.5 p-2"
          >
            {DICE.map((d, i) => (
              <motion.button
                key={d}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                disabled={rolling}
                onClick={() => void rollFree(d)}
                className="skin-title rounded-skin border border-line bg-black/25 px-3 py-2 text-sm text-ink transition hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:opacity-40"
              >
                {d}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
