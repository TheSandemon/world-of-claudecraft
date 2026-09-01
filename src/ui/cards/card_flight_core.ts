// Pure core for the card flight: the transform that carries a card from where
// it was to where it lands.
//
// A played card used to vanish from the hand and reappear (or not) on the
// stage a round later, so the table never showed the one thing every card game
// shows: a card being PUT DOWN. This decides the geometry of that move; the
// DOM half (card_flight.ts) reads the two rectangles and applies it.
//
// Deliberately a FLIP-style transform rather than an animated left/top: the
// flying node is positioned once at its origin and then only ever transformed,
// so the whole move costs the compositor and never the layout engine, which is
// what keeps it affordable on the machines this repo cares about.

export interface FlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FlightTransform {
  /** Pixels to travel, from the origin rect's top-left. */
  dx: number;
  dy: number;
  /** How much the card has to grow or shrink to match the destination. */
  scaleX: number;
  scaleY: number;
}

/** A destination with no size (an element that is not laid out yet) leaves the
 *  card its own size rather than collapsing it to nothing. */
function ratio(to: number, from: number): number {
  if (from <= 0 || to <= 0) return 1;
  return to / from;
}

/**
 * The move from one rectangle to another.
 *
 * Measured CENTRE to CENTRE, not corner to corner: the card also changes size
 * on the way (a hand card is smaller than a stage card), and a corner-anchored
 * move with a scale on top of it visibly drifts off its target as the scale
 * grows. Centres stay put under scaling, which is the whole reason.
 */
export function flightTransform(from: FlightRect, to: FlightRect): FlightTransform {
  const fromCx = from.left + from.width / 2;
  const fromCy = from.top + from.height / 2;
  const toCx = to.left + to.width / 2;
  const toCy = to.top + to.height / 2;
  return {
    dx: toCx - fromCx,
    dy: toCy - fromCy,
    scaleX: ratio(to.width, from.width),
    scaleY: ratio(to.height, from.height),
  };
}

/** The CSS the flying node ends on. Written here so the shape of the string is
 *  testable without a browser. */
export function flightTransformCss(t: FlightTransform): string {
  const round = (n: number) => Math.round(n * 100) / 100;
  return `translate(${round(t.dx)}px, ${round(t.dy)}px) scale(${round(t.scaleX)}, ${round(t.scaleY)})`;
}

/**
 * How long the flight takes, in milliseconds.
 *
 * Distance-scaled between a floor and a ceiling: a card moving two inches and
 * a card crossing the table should not take the same time, and neither should
 * outlast the beat it belongs to. Bounded above by the deal beat
 * (CARD_NARRATION_BEATS.deal), because the flight is what that beat IS: the
 * ceiling moved with the beat when the beats were lengthened, and it may never
 * pass it.
 */
export const FLIGHT_MIN_MS = 200;
export const FLIGHT_MAX_MS = 460;

export function flightDurationMs(t: FlightTransform): number {
  const distance = Math.hypot(t.dx, t.dy);
  const scaled = FLIGHT_MIN_MS + (distance / 400) * (FLIGHT_MAX_MS - FLIGHT_MIN_MS);
  return Math.round(Math.min(FLIGHT_MAX_MS, Math.max(FLIGHT_MIN_MS, scaled)));
}
