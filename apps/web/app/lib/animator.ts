export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export type Step = (t: number) => void // t in [0,1]

export async function tween(durationMs: number, step: Step): Promise<void> {
  const start = (typeof performance !== 'undefined' ? performance.now() : Date.now())
  return new Promise<void>((resolve) => {
    function frame(nowRaw: number) {
      const now = nowRaw ?? (typeof performance !== 'undefined' ? performance.now() : Date.now())
      const t = Math.min(1, durationMs <= 0 ? 1 : (now - start) / durationMs)
      try { step(t) } catch { /* ignore */ }
      if (t < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
}

// Common easing helpers
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
export const easeInCubic = (t: number) => Math.pow(t, 3)
export const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t)

