// Pure view-core for the END of a match: the beats that play AFTER the last
// round has finished being told, before the summary takes the window.
//
// DOM-free and i18n-free, exactly like duel_beats_core.ts, whose beat shape it
// reuses on purpose. A match ending is not a second animation vocabulary: it is
// more beats, written in the same grammar, played by the same driver, through
// the same host, onto the same `data-beat` attribute. tests/duel_outro_core.ts
// drives it with plain data.
//
// WHY IT EXISTS. The match-end event arrives from the sim in the same tick as
// the final round's resolution, and the window used to answer it by stopping
// the theater and rendering the summary in the same frame. So the round that
// DECIDED the match was the one round a player never got to watch: the cards
// were still face-down on the stage when the scoreboard replaced them. A match
// should end on its loudest moment, not by having that moment deleted.
//
// The fairness rule from src/ui/cards/CLAUDE.md carries over unchanged: these
// beats are pacing, not information. Nothing here gates a number. The summary
// they delay is a READOUT of a match that is already over, and every value in
// it was already true on the table underneath.

import type { DuelBeat, DuelMotion, DuelSpotlight } from './duel_beats_core';

/** How the match ended, from the viewer's seat. */
export type DuelMatchOutcome = 'win' | 'lose' | 'draw';

/** The three outro phases, in the order they play. */
export type DuelOutroPhase = 'finish' | 'glory' | 'curtain';

/**
 * How long each outro beat holds before the next one opens, in milliseconds.
 *
 * Deliberately NOT derived from CARD_NARRATION_BEATS: those are the sim's own
 * held-clock budget for narrating a round, and the sim is not holding anything
 * here. The match is over, no clock is running, and nothing the player could
 * act on is waiting behind these. They are sized to be watchable and then to
 * get out of the way: a shade over three seconds in total, which is about one
 * unhurried breath and well under the point where a player reaches for the
 * mouse.
 */
export const DUEL_OUTRO_GAP_MS: Readonly<Record<DuelOutroPhase, number>> = {
  // The blow that ended it: the losing seat's health bar is what the whole
  // match was spent on, so it is what the ending points at.
  finish: 900,
  // The flourish. The one beat that is purely for effect, and the longest,
  // because it is the moment the match is actually FOR.
  glory: 1500,
  // The hand-off: the table quiets down and the summary comes up over it. A
  // summary that cut in on the frame after the flourish would read as an
  // interruption of the thing it is reporting.
  curtain: 700,
};

/**
 * The pause between the round's last beat and the ending's first.
 *
 * Without it the ending begins in the SAME frame the round finishes, and the
 * settle beat (the finished picture: both faces up, the winner's edge lit, the
 * spent cards on their way to the piles) is written and overwritten before a
 * single frame paints it. The round would still be fully told and the player
 * would still never see the end of it, which is the same complaint one layer
 * down.
 */
export const DUEL_OUTRO_LEAD_MS = 600;

/** Every millisecond the outro occupies, including the last beat's own hold.
 *  This is when the summary is owed the window. */
export function duelOutroSpanMs(beats: readonly DuelBeat[]): number {
  if (beats.length === 0) return 0;
  const last = beats[beats.length - 1];
  return last.at + DUEL_OUTRO_GAP_MS[last.phase as DuelOutroPhase];
}

/**
 * The beats that end a match.
 *
 * The spotlight follows the same rule the round beats follow: it names the
 * thing the beat is ABOUT, so a player watching the middle of the table is
 * told where to look. `finish` points at whichever health bar ran out, which
 * is the one fact that ended the match; a draw points at neither, because a
 * draw is about the table rather than about a seat.
 *
 * `none` returns an EMPTY timeline rather than a collapsed one, and that is a
 * real distinction: a collapsed round still owes the player its cues and its
 * settled picture, but an outro that nobody is watching (a closed window, a
 * driver catching up) owes nothing at all. Its caller shows the summary at
 * once, which is the correct picture for a match that is already over.
 */
/**
 * The cue that rides one ending beat.
 *
 * These were silent, on the reasoning that the match end "already has its own
 * sound fired by the event handler". That was true and it was the defect: the
 * sound fired on the EVENT, which arrives in the same tick as the final round,
 * so a player heard the match end while the round that decided it was still
 * being told, and then watched three more beats go by in silence. It is the
 * same complaint the queued outro answers one layer up, and the same answer:
 * the ending's sound rides the ending's beat.
 *
 * So `glory` carries the match verdict, and it carries the EXISTING duel
 * recordings rather than new ones (`matchWin` / `matchLose` resolve to
 * duelEnd / arenaLoss in src/game/audio.ts). Nothing about the sound changed;
 * only when it plays did. A drawn match takes `push`, which is already the
 * vocabulary's word for "neither side took it".
 */
function outroCue(phase: DuelOutroPhase, outcome: DuelMatchOutcome): DuelBeat['cue'] {
  // A health bar empties: the one fact that ended the match.
  if (phase === 'finish') return 'finish';
  if (phase === 'glory') {
    if (outcome === 'win') return 'matchWin';
    if (outcome === 'lose') return 'matchLose';
    return 'push';
  }
  // The table clears and the summary is owed the window.
  return 'curtain';
}

export function buildDuelOutro(outcome: DuelMatchOutcome, motion: DuelMotion): DuelBeat[] {
  if (motion === 'none') return [];
  // The bar that emptied. A win means THEIR health ran out.
  const fatal: DuelSpotlight =
    outcome === 'win' ? 'theirs-hp' : outcome === 'lose' ? 'mine-hp' : null;
  const order: DuelOutroPhase[] = ['finish', 'glory', 'curtain'];
  const beats: DuelBeat[] = [];
  // Starts AFTER the round's settled picture has had a moment on screen, not
  // on top of it.
  let at = DUEL_OUTRO_LEAD_MS;
  for (const phase of order) {
    beats.push({
      phase: phase as DuelBeat['phase'],
      at,
      cue: outroCue(phase, outcome),
      step: null,
      spotlight: phase === 'finish' ? fatal : null,
    });
    at += DUEL_OUTRO_GAP_MS[phase];
  }
  return beats;
}

/** True for a beat this core produced, so a caption or a painter can tell an
 *  outro beat from a round beat without a second attribute to keep in sync. */
export function isDuelOutroBeat(beat: DuelBeat): boolean {
  return beat.phase === 'finish' || beat.phase === 'glory' || beat.phase === 'curtain';
}
