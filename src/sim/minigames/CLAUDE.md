<!-- src/sim/minigames/: pure minigame rules cores. Root CLAUDE.md owns the repo-wide
     rules (determinism, Rng, module-first, i18n); don't repeat them here. -->

# src/sim/minigames - pure minigame rules

A minigame folder here owns **rules only**: pure functions over its own state,
with no `SimContext`, no `Sim`, no DOM, and no i18n. That is what lets the same
rules run identically in the offline browser world, on the authoritative
server, and in the headless RL env.

## What lives here, and what does not

| Concern | Home |
|---|---|
| Rules, deck/hand state, resolution, bot policies | here |
| Match orchestration bound to `SimContext` (players, emits, deed stats, deadlines) | `src/sim/social/` or the owning system |
| Card/opponent content records | `src/sim/content/` |
| Player-visible strings | `src/ui/i18n.catalog/`, never here |

The orchestrator calls in; the rules never call out. A module here that needs
`ctx` is a sign the logic belongs in the orchestrator, or that the orchestrator
should pass the fact in as a plain argument.

## A folder is not automatic

**A minigame with a single small pure core does not need a folder.** The repo's
other minigames are correctly flat: `src/sim/lockpick.ts` (driven by
`src/sim/delves/lockpick_controller.ts`) and `src/sim/professions/fishing.ts`.
Earn the directory the way `card_duel/` did, with a multi-file subsystem that
wants a barrel and a local `CLAUDE.md` (root CLAUDE.md, Modularity).

## Determinism

Randomness goes through the `{ next(): number }` rng the caller injects, never
`Math.random`, and a folder **declares which of its modules may draw** so the
parity golden's draw count stays a property of a named few files. `card_duel/`
declares two (`deck.ts`, `selectors.ts`) and pins the rest with a guard test.
