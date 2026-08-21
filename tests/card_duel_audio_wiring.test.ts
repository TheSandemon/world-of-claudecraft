// Source-guard for the Card Duel hud.ts audio wiring (the
// player_death_audio.test.ts pattern): the sim-behavior side (which event
// fires with which fields) is covered by tests/card_duel_audio_events.test.ts;
// this pins that hud.ts's case blocks actually call the right audio.* method
// for each event, including the layered reveal+push and reveal+shuffle cases.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const hud = readFileSync(join(__dirname, '../src/ui/hud.ts'), 'utf8');

function caseBody(caseLabel: string): string {
  const start = hud.indexOf(`case '${caseLabel}':`);
  expect(start, caseLabel).toBeGreaterThan(-1);
  const end = hud.indexOf('break;', start);
  return hud.slice(start, end);
}

describe('Card Duel audio wiring in hud.ts', () => {
  it('plays the shuffle cue when a match starts', () => {
    expect(caseBody('cardDuelMatchStart')).toContain('audio.cardShuffle();');
  });

  it('plays the play cue when a card is played', () => {
    expect(caseBody('cardPlayed')).toContain('audio.cardPlay();');
  });

  it('hands a resolved round to the shared feedback module, audio and all', () => {
    // The round's three cues no longer fire here. They ride the BEATS of the
    // round theater (the reveal sound when the cards turn, the push sound on
    // the verdict, the shuffle when the hand refills), so the audio surface is
    // handed down with the event rather than played at the switch. The cue
    // mapping itself is pinned where it now lives: tests/duel_beats_core and
    // tests/duel_theater for the timeline, tests/card_round_feedback for the
    // closed-window fallback that still plays all three at once.
    const body = caseBody('cardRoundResolved');
    expect(body).toContain('applyCardRoundFeedback(ev, audio, this.cardWindows.cardDuel)');
    // And the switch arm plays nothing itself: a cue fired here as well as on
    // its beat would double every sound.
    expect(body).not.toContain('audio.card');
  });

  it('reuses duelEnd for a match win and arenaLoss for a match loss, not new recordings', () => {
    const body = caseBody('cardDuelMatchEnd');
    // Pin the branch direction itself, not just that both cues appear
    // somewhere in the case: a swapped if (ev.won) would still pass a bare
    // toContain check on both lines.
    expect(body).toContain('if (ev.won) audio.duelEnd();');
    expect(body).toContain('else audio.arenaLoss();');
  });
});
