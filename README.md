# Monopoly

# HOW TO RUN:

## Terminal 1:

```
cd C:\\Users\\sonat\\Desktop\\monopolytr\\monopoly
pnpm -C apps/server dev
```

## Terminal 2

```
cd C:\\Users\\sonat\\Desktop\\monopolytr\\monopoly
$env:NEXT_PUBLIC_SOCKET_URL="http://127.0.0.1:8787"; pnpm -C apps/web dev
```

## Docs

- Spec and rules: `docs/SPEC.md`
- Asset checklist: `docs/ASSETS.md`
- Acceptance criteria: `docs/ACCEPTANCE.md`

## Performance

- FPS cap: Desktop 120Hz, Mobile 60Hz by default.
- To enable limitless rendering, run in DevTools console:
  `window.MonopolySettings?.setFpsMode('limitless')`
  To restore default caps:
  `window.MonopolySettings?.setFpsMode('auto')`

## Token Y Offsets

- Global default per-token Y gaps live in `packages/shared/tokenY.ts`. Edit this file to change defaults for everyone.
- Keys are derived from model filenames (e.g., `Cat.stl` → `CAT`).
- You can also override at runtime if needed (for quick testing only):
  `window.MonopolySettings?.setTokenY('CAT', 0.02)`
  Defaults from `tokenY.ts` take precedence over runtime values unless explicitly overridden via the `tokenGapsY` prop.

## API Proxy

- The web app exposes `GET /api/rooms` and proxies it to the game server.
- It uses `NEXT_PUBLIC_API_URL` if set; otherwise falls back to `NEXT_PUBLIC_SOCKET_URL` or `http://127.0.0.1:8787`.
- No extra Next.js rewrite config is required for local dev.
