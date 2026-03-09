/**
 * FSRS (Free Spaced Repetition Scheduler) v5 — JS implementation
 * Based on the open-source FSRS algorithm by Jarrett Ye.
 *
 * Core concepts:
 *   Stability (S)  – expected number of days until recall probability drops to 90%
 *   Difficulty (D)  – intrinsic difficulty of a card [1, 10]
 *   Rating          – 1=Again, 2=Hard, 3=Good, 4=Easy
 */

const FSRS = (() => {
  // Default FSRS-5 weights (w0..w18)
  const DEFAULT_W = [
    0.4072, 1.1829, 3.1262, 15.4722,   // w0-w3: initial stability per rating
    7.2102,                              // w4: initial difficulty
    0.5316,                              // w5: difficulty adjustment
    1.0463,                              // w6: difficulty reversion
    0.0575,                              // w7: stability after forget (multiplier)
    1.7023,                              // w8: stability after forget (S exponent)
    0.0091,                              // w9: stability after forget (D exponent)
    1.0000,                              // w10: stability after forget (retrievability exponent)
    2.0902,                              // w11: recall stability (D factor)
    0.0110,                              // w12: recall stability (S factor)
    0.3111,                              // w13: recall stability (retrievability factor)
    1.5039,                              // w14: recall stability (exponent)
    0.2690,                              // w15: hard penalty
    2.4868,                              // w16: easy bonus
    0.6571,                              // w17: short-term stability after forget
    0.8631,                              // w18: short-term stability multiplier
  ];

  const DECAY = -0.5;
  const FACTOR = 19 / 81; // (0.9^(1/DECAY) - 1)

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  /**
   * Retrievability — probability of recall after `elapsed` days with stability `s`.
   */
  function retrievability(elapsed, s) {
    if (s <= 0) return 0;
    return Math.pow(1 + FACTOR * elapsed / s, DECAY);
  }

  /**
   * Initial stability after seeing a card for the first time.
   */
  function initStability(rating, w = DEFAULT_W) {
    return Math.max(w[rating - 1], 0.1);
  }

  /**
   * Initial difficulty after first rating.
   */
  function initDifficulty(rating, w = DEFAULT_W) {
    const d = w[4] - Math.exp(w[5] * (rating - 1)) + 1;
    return clamp(d, 1, 10);
  }

  /**
   * Next difficulty after a review.
   */
  function nextDifficulty(d, rating, w = DEFAULT_W) {
    const dNext = w[6] * initDifficulty(3, w) + (1 - w[6]) * (d - w[7] * (rating - 3));
    return clamp(dNext, 1, 10);
  }

  /**
   * Next stability after a *successful* recall (rating >= 2).
   */
  function nextRecallStability(d, s, r, rating, w = DEFAULT_W) {
    const hardPenalty = rating === 2 ? w[15] : 1;
    const easyBonus = rating === 4 ? w[16] : 1;
    return s * (
      1 +
      Math.exp(w[11]) *
      (11 - d) *
      Math.pow(s, -w[12]) *
      (Math.exp((1 - r) * w[13]) - 1) *
      hardPenalty *
      easyBonus
    );
  }

  /**
   * Next stability after a *lapse* (rating === 1).
   */
  function nextForgetStability(d, s, r, w = DEFAULT_W) {
    return Math.max(
      w[8] *
      Math.pow(d, -w[9]) *
      (Math.pow(s + 1, w[10]) - 1) *
      Math.exp((1 - r) * w[17]),
      0.1
    );
  }

  /**
   * Schedule the next review interval from stability.
   * desired_retention defaults to 0.9.
   */
  function nextInterval(s, desiredRetention = 0.9) {
    const interval = (s / FACTOR) * (Math.pow(desiredRetention, 1 / DECAY) - 1);
    return Math.max(Math.round(interval), 1);
  }

  /**
   * Process a review and return the updated card state.
   *
   * card: { stability, difficulty, lastReview (ISO), reps, lapses, state }
   * rating: 1-4
   * now: Date
   *
   * Returns new card object.
   */
  function review(card, rating, now = new Date(), w = DEFAULT_W) {
    const isNew = card.state === 'new';
    let s, d, elapsed, predictedR;

    if (isNew) {
      s = initStability(rating, w);
      d = initDifficulty(rating, w);
      elapsed = 0;
      predictedR = 0.9;
    } else {
      elapsed = (now - new Date(card.lastReview)) / (1000 * 60 * 60 * 24); // days
      predictedR = retrievability(elapsed, card.stability);
      const r = predictedR;
      d = nextDifficulty(card.difficulty, rating, w);

      if (rating === 1) {
        s = nextForgetStability(card.difficulty, card.stability, r, w);
      } else {
        s = nextRecallStability(card.difficulty, card.stability, r, rating, w);
      }
    }

    const interval = nextInterval(s);
    const due = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

    return {
      stability: s,
      difficulty: d,
      lastReview: now.toISOString(),
      due: due.toISOString(),
      interval: interval,
      reps: (card.reps || 0) + 1,
      lapses: rating === 1 ? (card.lapses || 0) + 1 : (card.lapses || 0),
      state: 'review',
      predictedR: predictedR,
    };
  }

  /**
   * Given current card state, preview what each rating would produce.
   */
  function previewRatings(card, now = new Date(), w = DEFAULT_W) {
    const labels = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
    const result = {};
    for (let r = 1; r <= 4; r++) {
      const next = review(card, r, now, w);
      result[r] = { label: labels[r], interval: next.interval, due: next.due };
    }
    return result;
  }

  return { review, previewRatings, retrievability, nextInterval, DEFAULT_W };
})();

if (typeof module !== 'undefined') module.exports = FSRS;
