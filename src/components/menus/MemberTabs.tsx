import { useGame } from '../../store/game'
import { Tabs } from '../ui'

/** Party member selector shared by the character sheet and inventory. */
export function useMemberSelection() {
  const { party, menuMember, openMenu, menu } = useGame()
  const selected = party.find((p) => p.id === menuMember) ?? party.find((p) => p.isPlayer)!
  const select = (id: string) => openMenu(menu, id)
  return { party, selected, select }
}

export function MemberTabs() {
  const { party, selected, select } = useMemberSelection()
  return (
    <Tabs
      tabs={party.map((p) => ({ id: p.id, label: `${p.icon} ${p.name}` }))}
      value={selected.id}
      onChange={select}
    />
  )
}
