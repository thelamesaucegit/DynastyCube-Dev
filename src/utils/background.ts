import artifact from '../assets/backgrounds/artifact.jpeg'
import artifact2 from '../assets/backgrounds/artifact2.jpeg'
import forest from '../assets/backgrounds/forest.jpeg'
import forest2 from '../assets/backgrounds/forest2.jpeg'
import island from '../assets/backgrounds/island.jpeg'
import island2 from '../assets/backgrounds/island2.jpeg'
import mountain from '../assets/backgrounds/mountain.jpeg'
import mountain2 from '../assets/backgrounds/mountain2.jpeg'
import plains from '../assets/backgrounds/plains.jpeg'
import plains2 from '../assets/backgrounds/plains2.jpeg'
import swamp from '../assets/backgrounds/swamp.jpeg'
import swamp2 from '../assets/backgrounds/swamp2.jpeg'

const backgroundUrls: string[] = [
  artifact as unknown as string,
  artifact2 as unknown as string,
  forest as unknown as string,
  forest2 as unknown as string,
  island as unknown as string,
  island2 as unknown as string,
  mountain as unknown as string,
  mountain2 as unknown as string,
  plains as unknown as string,
  plains2 as unknown as string,
  swamp as unknown as string,
  swamp2 as unknown as string,
]

function pickBackground(): string {
  if (typeof localStorage === 'undefined') return backgroundUrls[0] ?? ''
  const HOUR_MS = 60 * 60 * 1000
  const stored = localStorage.getItem('argentum-bg')
  if (stored) {
    const { index, timestamp } = JSON.parse(stored)
    if (Date.now() - timestamp < HOUR_MS && backgroundUrls[index]) {
      return backgroundUrls[index]
    }
  }
  const index = Math.floor(Math.random() * backgroundUrls.length)
  localStorage.setItem('argentum-bg', JSON.stringify({ index, timestamp: Date.now() }))
  return backgroundUrls[index] ?? ''
}

export const randomBackground = pickBackground()
