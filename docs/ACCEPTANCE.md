**Acceptance Criteria by Epic**

**Epic 0 — Foundations & Scope**
- SPEC and ASSETS docs published; rule variants and NFRs agreed.
- Auction, jail, mortgage, even‑building decisions documented and surfaced in UI copy.

**Epic 1 — Board & Data (M1)**
- Board data contains 40 unique IDs (0–39) with correct types and rents; mortgage values are 50% of price; house/hotel costs match color groups.
- Complete color sets are present and contiguous per classic board.
- Data loads into app state; each rendered tile matches its ID and coordinates; visual positions align with `board.png`.
- Validation pass: unique IDs, legal rent tables, consistent mortgage/unmortgage cost rules.

**Epic 2 — Lobby & Token Selection (M2)**
- Room join handles name collisions deterministically; seat list shows up to 8 slots.
- Token selector prevents duplicate color assignment; token mesh selection broadcast live.
- Readiness toggle per player; host start enabled only with valid, non‑duplicate selections and ≥2 players.
- Late‑join becomes spectator after game start.

**Epic 3 — Starting Order (M3)**
- All players roll two dice server‑authoritatively; results visible to all.
- Ties broken by: sum → highest single die → alphabetical by name; deterministic for multiple ties.
- Final order is frozen and announced; turn index starts at player 0.

**Epic 4 — Dice System (M4)**
- Server is the single source of truth for dice outcomes; clients sync without divergence.
- 3D dice animation plays for roller; spectators see a shortened sync version; final face matches server result.
- 2D overlay shows both dice and sum; tie‑break hints available during order phase.
- Low‑end devices show no stutter beyond perf budget; frame pacing within targets.

**Epic 5 — Movement & Cinematics (M5)**
- Tokens move tile‑to‑tile along board path; wrap across GO correctly and salary applied.
- Land animations: hop, rotate, puff on arrival; camera follows tastefully.
- Go To Jail moves along curated path to Jail with camera cue; `inJail` state set.
- Positions and balances remain consistent with rules after all movements.

**Epic 6 — Property Cards UX (M6)**
- Player card stacks render adjacent to frames; keep‑cards are visually separate from properties.
- Clicking a player’s stack opens their property grid; read‑only if not self.
- Clicking a card flips front ⇄ mortgage/back; mortgage state clear and consistent.
- Double‑click/long‑press opens action modal; actions gated by ownership/legality.

**Epic 7 — Economy & Privacy (M7)**
- Only self balance is visible; others’ balances obfuscated (e.g., ranges or hidden).
- Transfers include: Bank ⇄ player, player ⇄ player, rent, and taxes; all mutations processed server‑side.
- Money animations visually trace transfers between frames.

**Epic 8 — Mortgage Mechanics (M8)**
- No rent is charged on mortgaged properties; attempts to collect rent are blocked with clear feedback.
- Even‑building constraints enforced for buying/selling houses; must liquidate buildings before mortgaging.
- Unmortgaging costs mortgage value + 10% interest; UI shows costs and blocked actions clearly.
- State remains consistent after trades and auctions.

**Epic 9 — Buy Prompt, Auctions & Timers (M9)**
- Buy prompt appears on landing on unowned property; timeboxed with default choice to decline.
- Declines/timeouts reliably start auctions; server arbitrates bids with min increment and last‑seconds extension.
- Auctions end with a single winner, funds deducted, and ownership updated atomically.

**Epic 10 — Trading (M10)**
- Offers support: cash, properties, keep‑cards on both sides; multiple items per side.
- Negotiation supports counter, accept/decline; finalization is atomic (all updates or none).
- Eligibility respects mortgage rules; clear warnings if mortgaged items carry hidden penalties.

**Epic 11 — Turn Flow & Indicators (M11)**
- Turn state machine: Roll → resolve movement/cards → buy/auction → post‑actions (build/mortgage/trade) → end turn.
- A visible pointer hovers above active player’s frame and token.
- Inputs outside permitted actions during others’ turns are disabled with informative affordances.

**Epic 12 — Audio & Feedback (M12)**
- SFX map implemented for: roll, land, cash, auction tick, confirm, error.
- Per‑user volume with mute toggle persisted locally; accessible defaults.

**Epic 13 — Performance, QA & Accessibility (M13)**
- Perf budgets respected on desktop and mobile (FPS, shadow maps, particle caps).
- Test plan covers: unit (rules/order/rents), integration (auctions/trades), soak (multi‑hour), and network jitter.
- A11y checks pass: color‑blind palette, contrast, focus order, keyboard navigation for key dialogs.

