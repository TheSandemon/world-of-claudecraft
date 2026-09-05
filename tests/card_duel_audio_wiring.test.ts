// Source-guard for the ClaudeStone hud.ts audio wiring (the
// player_death_audio.test.ts pattern): the sim-behavior side (which event
// fires with which fields) is covered by tests/card_duel_audio_events.test.ts;
// this pins that hud.ts's case blocks actually call the right audio.* method
// for each event, including the layered reveal+push and reveal+shuffle cases.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const hud = readFileSync(join(__dirname, '../src/ui/hud.ts'), 'utf8');
const gameAudio = readFileSync(join(__dirname, '../src/game/audio.ts'), 'utf8');

function caseBody(caseLabel: string): string {
  const start = hud.indexOf(`case '${caseLabel}':`);
  expect(start, caseLabel).toBeGreaterThan(-1);
  const end = hud.indexOf('break;', start);
  return hud.slice(start, end);
}

describe('ClaudeStone audio wiring in hud.ts', () => {
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

  it('hands the match ending to the shared feedback module and plays nothing itself', () => {
    // The verdict cue moved off this event onto the ENDING's own `glory` beat
    // (duel_outro_core.ts). The sim emits cardDuelMatchEnd in the same tick as
    // the final cardRoundResolved, so firing it here meant a player heard the
    // match end while the round that decided it was still being told; firing
    // it here as well would now double it. The fallback for an ending nothing
    // narrates lives with the round's own fallback, and is pinned there
    // (tests/card_round_feedback.test.ts).
    const body = caseBody('cardDuelMatchEnd');
    expect(body).toContain('applyCardMatchEndFeedback(ev, audio, this.cardWindows.cardDuel)');
    expect(body).not.toContain('audio.');
  });

  it('still reuses duelEnd for a match win and arenaLoss for a loss, not new recordings', () => {
    // The same claim the arm above used to carry, pinned where it now lives.
    // What was wrong with the match-end sound was WHEN it played, never what
    // it sounded like, so the two cues resolve to the existing duel
    // recordings rather than to anything new.
    //
    // Pin the branch direction itself, not just that both names appear: a
    // swapped pair would pass a bare toContain check on both lines.
    const method = (name: string) => {
      const start = gameAudio.indexOf(`${name}(): void {`);
      expect(start, name).toBeGreaterThan(-1);
      return gameAudio.slice(start, gameAudio.indexOf('}', start));
    };
    expect(method('cardMatchWin')).toContain('UI_CUES.duelEnd');
    expect(method('cardMatchLose')).toContain('UI_CUES.arenaLoss');
  });
});
