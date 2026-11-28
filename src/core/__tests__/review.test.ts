import { describe, expect, it } from 'vitest';

import { newReviewState, noteAsked, noteUse, shouldAskReview } from '../review';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1, 12);

describe('Fenêtre d’avis du Play Store', () => {
  it('pas tout de suite : 3 jours d’installation et 3 jours d’usage', () => {
    let s = newReviewState(T0);
    s = noteUse(s, T0);
    s = noteUse(s, T0 + 1000);
    expect(s.days).toHaveLength(1);
    expect(shouldAskReview(s, T0 + 5 * DAY)).toBe(false);
    s = noteUse(noteUse(s, T0 + DAY), T0 + 2 * DAY);
    expect(shouldAskReview(s, T0 + 2 * DAY)).toBe(false);
    expect(shouldAskReview(s, T0 + 3 * DAY)).toBe(true);
  });
  it('rarement : 4 mois d’écart, 3 fois au plus', () => {
    let s = [0, 1, 2].reduce((acc, d) => noteUse(acc, T0 + d * DAY), newReviewState(T0));
    s = noteAsked(s, T0 + 3 * DAY);
    expect(shouldAskReview(s, T0 + 30 * DAY)).toBe(false);
    expect(shouldAskReview(s, T0 + 124 * DAY)).toBe(true);
    s = noteAsked(noteAsked(s, T0 + 124 * DAY), T0 + 250 * DAY);
    expect(shouldAskReview(s, T0 + 2000 * DAY)).toBe(false);
  });
});
