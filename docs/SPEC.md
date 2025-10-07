**MonopolyTR Spec — Foundations & Rules**

- Scope: Online, server‑authoritative Monopoly variant with card‑first UX and synchronized 3D/2D dice and movement.
- Version: v1.0 (Foundations)

**Ruleset Decisions (E0.1)**
- Auctions on decline: Enabled. Declining or timing out on an unowned property immediately starts a server‑run auction with a configured `minIncrement` and last‑bid extension window.
- Go salary: Collect `200` upon passing or landing on GO.
- Taxes: Income Tax is a flat `200`; Luxury Tax is `100`.
- Jail entry: Landing on “Go To Jail” moves directly to Jail; do not collect GO.
- Jail exit: On your turn, before rolling, choose one: pay `50` and roll/move; use a Get‑Out‑Of‑Jail card and roll/move; or attempt to roll doubles up to 3 turns. If doubles are rolled, exit and move by that roll. On the 3rd failed attempt, pay `50` and move by that roll.
- Doubles: Rolling doubles grants another turn. Three consecutive doubles sends the player to Jail immediately (no movement by the third roll).
- Utilities: Rent equals dice sum × multiplier: one utility owned → ×4; both → ×10.
- Stations (railroads): Rent by count owned → 25, 50, 100, 200.
- Building rules: Even building required across a color set (distribute/sell houses evenly). Must sell down buildings in the same even manner.
- Bank limits: 32 houses, 12 hotels. If shortage occurs, remaining buildings are auctioned by the bank.
- Mortgage: Mortgage value = 50% of face price. No rent can be charged on mortgaged properties. To unmortgage: pay mortgage value + 10% interest in one payment.
- Forced liquidation: To pay a debt, players may sell buildings back to the bank (at half the cost) observing even‑building rules, then mortgage. If still insolvent, bankruptcy occurs.
- Bankruptcy: If unable to pay a player, transfer all cash and unmortgaged assets to the creditor, who may choose to immediately pay 10% to unmortgage or keep mortgaged. If unable to pay the bank, properties return to bank; any mortgaged remain so; each is auctioned.
- Trading: Allowed between players when not in the middle of an auction resolution animation or dice resolution. Trades are atomically committed (all‑or‑nothing).
- Free Parking: No payout (pot disabled) for clarity and competitive integrity.
- Chance/Community: Standard effects: money, movement, Go To Jail, Get Out Of Jail. Repair/fee cards reserved for later phase (already modeled in types).
- Tie‑breakers (turn order): Highest sum → highest individual die → alphabetical by display name (stable, deterministic).

**Non‑Functional Requirements (E0.2)**
- Players: 2–8 supported; recommend 3–6. Eight unique player colors guaranteed.
- Connectivity: Server‑authoritative state with idempotent events; clients can reconnect and resync within 5s under moderate network jitter (≤150ms RTT, ±5% packet loss) without desync.
- Performance targets:
  - Desktop: 60 FPS target on mid‑range GPUs; shadow map ≤ 1024, capped particle effects, dice animation ≤ 2s for roller; 0.5–1s synced replay for others.
  - Mobile: 30 FPS target on mid‑range devices; shadows disabled by default; fall back to baked lighting; animation LOD applied for non‑rollers.
  - Default caps: Desktop render loop capped at 120Hz; Mobile at 60Hz; a user setting allows limitless rendering for high‑end devices.
- Accessibility baseline:
  - Color contrast ratio ≥ 4.5:1 for UI text; color‑blind‑safe palettes for players and tile groups.
  - Keyboard: Focus order for modals/dialogs; ESC closes non‑destructive modals; TAB traversal for all actionable controls.
  - Screen reader: Labels for buttons, dice results, money changes, and card actions; ARIA roles for dialogs.
- Security & fairness: Dice results are produced and signed server‑side; clients never propose authoritative roll outcomes.
- Internationalization: Turkish board data present; English strings planned. Currency display per board data (`TRY`, `USD`, `GBP`).

**Late‑Join Policy**
- Players may join a room until the host starts the game. After start, late joiners become spectators (read‑only) unless a house rule explicitly allows mid‑game join (out of scope for v1.0).

**House Rules Toggle (Future)**
- Optional variants (disabled by default): Free Parking pot, Income Tax (10% vs flat), trading windows (anytime vs turn‑only). Not part of v1.0 acceptance; reserved for post‑M13.
