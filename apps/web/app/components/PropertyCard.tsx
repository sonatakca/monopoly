"use client"

import React, { useState } from 'react'

export default function PropertyCard({ id, side = 'f', width = 220 }: { id: number; side?: 'f' | 'b'; width?: number }) {
  const [src, setSrc] = useState(`/propertyCards/${id}${side}.png`)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={`card-${id}-${side}`}
      src={src}
      width={width}
      style={{ display: 'block', imageRendering: 'auto', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}
      onError={() => {
        // fallback to low quality if exists
        const low = `/propertyCards/lowQuality/${id}${side}.png`
        if (src !== low) setSrc(low)
      }}
    />
  )
}

