export type SkinId = 'heroic' | 'grim' | 'bright' | 'mystery' | 'horror' | 'sea'

export interface Skin {
  id: SkinId
  name: string
  tone: string
  tagline: string
  /** preview swatches: background, surface, accent, accent-2 */
  swatch: [string, string, string, string]
  font: string
}

export const SKINS: Skin[] = [
  { id: 'heroic', name: 'Gilded Tome', tone: 'Heroic', tagline: 'Gold leaf, old leather, legends in the making.', swatch: ['#0d0907', '#30221a', '#e0a84a', '#f6d27a'], font: '"Cinzel", serif' },
  { id: 'grim', name: 'Iron & Ash', tone: 'Grim & dark', tagline: 'Rust, soot and hard choices.', swatch: ['#09090b', '#27272a', '#d9622b', '#f59e0b'], font: '"IM Fell English SC", serif' },
  { id: 'bright', name: 'Fable', tone: 'Lighthearted', tagline: 'Soft lights, bright friends, silly heroes.', swatch: ['#0f1830', '#2c3a6e', '#6ee7b7', '#fda4af'], font: '"Fredoka", sans-serif' },
  { id: 'mystery', name: 'Arcane', tone: 'Mystery', tagline: 'Starlight, secrets and whispered runes.', swatch: ['#0a0616', '#281c4e', '#a78bfa', '#67e8f9'], font: '"Cormorant Garamond", serif' },
  { id: 'horror', name: 'Eldritch', tone: 'Horror', tagline: 'Candles gutter. Something listens.', swatch: ['#060505', '#201414', '#c0262d', '#84cc16'], font: '"UnifrakturMaguntia", serif' },
  { id: 'sea', name: 'High Seas', tone: 'Swashbuckling', tagline: 'Brass, salt and a fair wind.', swatch: ['#06121c', '#102c42', '#d4af37', '#2dd4bf'], font: '"Pirata One", serif' },
]

export const skinForTone = (tone: string): SkinId => SKINS.find((s) => s.tone === tone)?.id ?? 'heroic'
