'use client'

import { useGLTF, useTexture } from '@react-three/drei'

// Preload board texture
useTexture.preload?.('/board.png')

// Preload all dice animations so the first roll has no delay
const diceClips = [
  '1-1',
  '2-1','2-2',
  '3-1','3-2','3-3',
  '4-1','4-2','4-3','4-4',
  '5-1','5-2','5-3','5-4','5-5',
  '6-1','6-2','6-3','6-4','6-5','6-6',
]
diceClips.forEach(k => useGLTF.preload?.(`/animations/dice ${k}.glb`))

// Preload chance/community card textures (fronts + backs)
try {
  for (let i = 0; i < 16; i++) {
    useTexture.preload?.(`/kamuFonuVeSans/sans${i}.png`)
    useTexture.preload?.(`/kamuFonuVeSans/kamufonu${i}.png`)
  }
  useTexture.preload?.('/kamuFonuVeSans/sansB.png')
  useTexture.preload?.('/kamuFonuVeSans/kamuFonuB.png')
} catch {}
