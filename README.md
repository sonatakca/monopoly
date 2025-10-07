# Monopoly

# HOW TO RUN:

## Terminal 1:

```
cd C:\\Users\\sonat\\Desktop\\monopolytr\\monopoly
pnpm -C apps/server dev
```

To enable development-only helpers such as flushing in-memory rooms, set `DEV_ENABLE_FLUSH=1` when running the server. Once enabled, send a `POST` request to `http://127.0.0.1:8787/dev/flush` to clear all rooms and timers.

When deploying the client, point `NEXT_PUBLIC_SOCKET_URL` (and optionally `NEXT_PUBLIC_API_URL`) to your hosted game server. The default production build uses the Render deployment at `https://monopoly-socket-server.onrender.com`.

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
