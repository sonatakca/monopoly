**Assets Checklist**

**3D Dice (E0.3, E4.2)**
- GLB animations: Use `apps/web/public/animations/dice X-Y.glb` as the canonical set. Validate full coverage for (1..6, 1..6). For missing symmetrical pairs (e.g., `1-2`), reuse mirrored animation from `2-1` with face remapping and final hold.
- Duration: 1.6–2.0s for roller; synced spectators 0.6–1.0s (trimmed segment aligning on final hold).
- Materials: Single PBR with baked AO preferred; shadow catcher plane in scene; scale consistent with board.

**Player Tokens (E2.2)**
- Current STLs: `apps/web/public/models/Player Tokens/{Shoe,Hat,Dog,Car}.stl`.
- v1.0 plan: 8 player colors mapped to 4 token meshes (duplicate meshes allowed, disambiguated by color and name). Future: add 4 more meshes to reach 8 unique shapes.
- LOD: Single low‑poly LOD target ≤ 3k tris per token.

**Buildings**
- STLs present: `apps/web/public/models/Property Types/{House,Hotel}.stl`. Ensure consistent scale with board squares; pivot at base center.

**Board Texture**
- `apps/web/public/board.png` as main board map. Confirm alignment with ID 0–39 and rotation anchors. Keep source `Monopoly.png` and `Monopoly2.PNG` for reference only.

**UI Icon Set**
- Choice: Lucide (MIT) via `lucide-react`. Icons: dice, cash, auction gavel, confirm/check, error/x, volume, mute, settings, user, lock, unlock, eye (privacy), exchange (trade), house, hotel, hammer (mortgage), timer, pointer.

**Audio SFX (E12)**
- Formats: `ogg` + `mp3` fallback; peak normalized at −1 dBFS, integrated loudness around −18 LUFS.
- Cues: roll, land, cash in/out, auction tick, confirm, error, card flip, modal open/close, pointer move.
- Length: ≤1.0s except dice roll (≤2.0s) and auction tick (short discrete tick, 250–500ms cadence).

**Color Palette**
- Tile groups (classic): brown `#8B4513`, light blue `#8ED6F1`, pink `#E07BAA`, orange `#F59E0B`, red `#EF4444`, yellow `#FCD34D`, green `#10B981`, dark blue `#1F3A8A`.
- Player colors (8): `#1D4ED8`, `#16A34A`, `#DC2626`, `#7C3AED`, `#F59E0B`, `#0891B2`, `#EF4444` (alt red for color‑blind pairings), `#374151`.
- Ensure ≥4.5:1 contrast on neutral UI backgrounds; provide patterns/markers in addition to color.

**Fonts**
- System stack for performance; optional display face for headings if budget permits. Ensure Turkish glyph coverage.

**File Organization**
- 3D: `apps/web/public/models` and `apps/web/public/animations`.
- UI/audio: `apps/web/public/ui` and `apps/web/public/sfx` (to be created as needed).

