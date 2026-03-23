/**
 * BetterFSRS v0.9 — JavaScript port of the Python implementation.
 *
 * Architecture:
 *   Layer 1: Base FSRS-5 (w0-w18) — stability/difficulty tracking
 *   Layer 2: Calibration (w19-w29) — Platt scaling, asymmetric Platt, decay adjustments
 *   Layer 3: Discrimination (w30-w32) — non-monotonic features for AUC improvement
 *
 * 33 total parameters. Same review()/previewRatings() interface as FSRS.
 */

const BetterFSRS = (() => {
  // Full 33-param default weights from Python better_fsrs.py
  const DEFAULT_W = [
    0.40255, 1.18385, 3.173, 15.69105,       // w0-w3: init stability
    7.1949, 0.5345, 1.4604, 0.0046,           // w4-w7: difficulty
    1.54575, 0.1192, 1.01925,                  // w8-w10: stability increase
    1.9395, 0.11, 0.29605, 2.2698,            // w11-w14: post-lapse
    0.2315, 2.9898, 0.51655, 0.6621,          // w15-w18: modifiers
    0.4225, -0.1173,                           // w19-w20: Platt scaling
    -0.5, -0.0345,                             // w21-w22: decay, EMA
    3.4825, 0.1784,                            // w23-w24: spacing, lapse penalty
    0.0, 0.0,                                  // w25-w26: streak bonus, maturity
    0.5,                                       // w27: error correction
    0.0,                                       // w28: asymmetric Platt
    0.0,                                       // w29: post-lapse accel
    0.0,                                       // w30: streak discriminator
    0.0,                                       // w31: lapse fragility
    0.0,                                       // w32: overdue surprise
  ];

  const BASE_DECAY = -0.5;
  const FACTOR = 19 / 81;

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  function sigmoid(x) {
    if (x >= 0) {
      return 1.0 / (1.0 + Math.exp(-x));
    }
    const ex = Math.exp(x);
    return ex / (1.0 + ex);
  }

  function logit(p) {
    p = clamp(p, 1e-7, 1 - 1e-7);
    return Math.log(p / (1 - p));
  }

  function softplus(x) {
    if (x > 20) return x;
    return Math.log(1.0 + Math.exp(x));
  }

  // --- Forgetting curve with difficulty-dependent decay ---

  function decayForDifficulty(d, w = DEFAULT_W) {
    const w21 = clamp(w[21], -0.5, 0.5);
    const decay = BASE_DECAY - w21 * (d - 5.0) / 10.0;
    return clamp(decay, -0.9, -0.1);
  }

  function decayForCard(d, card, w = DEFAULT_W) {
    let decay = decayForDifficulty(d, w);
    const w29 = clamp(w[29], 0.0, 1.0);
    if (w29 > 1e-6 && card.reviewsSinceLapse < 5) {
      const lapseAccel = w29 * Math.exp(-0.5 * card.reviewsSinceLapse);
      decay = decay * (1.0 + lapseAccel);
      decay = clamp(decay, -0.9, -0.1);
    }
    return decay;
  }

  // --- Retrievability (calibrated, monotonic layer) ---

  function retrievability(t, s, d, card, w = DEFAULT_W) {
    if (s <= 0) return 0;
    if (t <= 0) return 1;

    d = d || 5.0;
    const decay = card ? decayForCard(d, card, w) : decayForDifficulty(d, w);
    let rRaw = Math.pow(1 + FACTOR * t / s, decay);
    rRaw = clamp(rRaw, 1e-7, 1 - 1e-7);

    // Platt scaling
    const slope = w[19];
    const intercept = w[20];
    const w28 = clamp(w[28], -0.5, 0.5);

    const logitR = logit(rRaw);

    // Asymmetric Platt
    const asym = w28 * logitR * softplus(logitR) / (1.0 + Math.abs(logitR));

    const logitCal = slope * logitR + intercept + asym;
    const rCal = sigmoid(logitCal);
    return clamp(rCal, 1e-7, 1 - 1e-7);
  }

  function retrievabilityRaw(t, s, d, w = DEFAULT_W) {
    if (s <= 0) return 0;
    if (t <= 0) return 1;
    const decay = decayForDifficulty(d || 5.0, w);
    return clamp(Math.pow(1 + FACTOR * t / s, decay), 0.0, 1.0);
  }

  // --- Full recall prediction (calibration + discrimination) ---

  function predictRecall(elapsed, card, w = DEFAULT_W) {
    const rCal = retrievability(elapsed, card.stability, card.difficulty, card, w);
    let lr = logit(rCal);

    // === Discrimination layer (v0.9) ===

    // w30: Streak discriminator
    const w30 = clamp(w[30], -0.5, 0.5);
    if (Math.abs(w30) > 1e-6 && (card.streak || 0) > 0) {
      lr += w30 * Math.tanh(card.streak / 5.0);
    }

    // w31: Lapse fragility
    const w31 = clamp(w[31], 0.0, 1.0);
    if (w31 > 1e-6 && (card.reviewsSinceLapse || 100) < 10) {
      lr -= w31 * Math.exp(-0.5 * card.reviewsSinceLapse);
    }

    // w32: Overdue surprise
    const w32 = clamp(w[32], -1.0, 1.0);
    if (Math.abs(w32) > 1e-6 && (card.lastScheduledInterval || 0) > 0 && elapsed > 0) {
      const logRatio = Math.log(Math.max(elapsed / card.lastScheduledInterval, 0.01));
      lr += w32 * Math.tanh(logRatio);
    }

    let rDisc = sigmoid(lr);

    // Maturity shrinkage (w26)
    const w26 = clamp(w[26], 0.0, 0.5);
    if (w26 > 1e-6 && (card.reps || 0) < 10) {
      const mf = 1.0 - w26 * Math.exp(-0.3 * card.reps);
      rDisc = sigmoid(logit(rDisc) * mf);
    }

    // Error correction (w27)
    const w27 = clamp(w[27], 0.0, 3.0);
    if ((card.reps || 0) >= 2 && Math.abs(card.errorEma || 0) > 1e-6) {
      rDisc = sigmoid(logit(rDisc) - w27 * card.errorEma);
    }

    return clamp(rDisc, 1e-7, 1 - 1e-7);
  }

  // --- Core FSRS-5 functions (base layer) ---

  function initStability(rating, w = DEFAULT_W) {
    return Math.max(w[rating - 1], 0.01);
  }

  function initDifficulty(rating, w = DEFAULT_W) {
    return clamp(w[4] - Math.exp(w[5] * (rating - 1)) + 1, 1, 10);
  }

  function nextDifficulty(d, rating, card, w = DEFAULT_W) {
    const deltaD = -w[6] * (rating - 3);
    const dPrime = d + deltaD * (10 - d) / 9.0;
    const d04 = initDifficulty(4, w);
    let dNew = w[7] * d04 + (1 - w[7]) * dPrime;
    const emaW = clamp(w[22], 0.0, 0.5);
    if ((card.reps || 0) >= 2) {
      dNew = (1 - emaW) * dNew + emaW * (card.difficultyEma || 5.0);
    }
    return clamp(dNew, 1, 10);
  }

  function nextRecallStability(d, s, r, rating, card, elapsed, w = DEFAULT_W) {
    const hardPenalty = rating === 2 ? w[15] : 1;
    const easyBonus = rating === 4 ? w[16] : 1;

    let sinc = (
      Math.exp(w[8]) *
      (11 - d) *
      Math.pow(s, -w[9]) *
      (Math.exp(w[10] * (1 - r)) - 1) *
      hardPenalty *
      easyBonus
    );

    // Spacing effect (w23)
    const w23 = clamp(w[23], -1.0, 5.0);
    let spBonus = 1.0;
    if ((card.lastScheduledInterval || 0) > 0 && elapsed > 0) {
      const overdue = elapsed / card.lastScheduledInterval;
      spBonus = 1.0 + w23 * Math.max(0.0, Math.log(Math.max(overdue, 0.1)));
    }
    spBonus = clamp(spBonus, 0.3, 5.0);

    // Streak bonus (w25)
    const w25 = clamp(w[25], 0.0, 1.0);
    const streakBonus = 1.0 + w25 * Math.log(1.0 + (card.streak || 0));

    sinc = sinc * spBonus * streakBonus;
    return s * (sinc + 1);
  }

  function nextForgetStability(d, s, r, card, w = DEFAULT_W) {
    let sF = (
      w[11] *
      Math.pow(d, -w[12]) *
      (Math.pow(s + 1, w[13]) - 1) *
      Math.exp(w[14] * (1 - r))
    );
    const w24 = clamp(w[24], 0.0, 0.5);
    sF = sF / (1.0 + w24 * (card.lapses || 0));
    return clamp(sF, 0.01, s);
  }

  function optimalInterval(s, d, desiredRetention = 0.9, w = DEFAULT_W) {
    if (desiredRetention <= 0 || desiredRetention >= 1 || s <= 0) return 1;
    const decay = decayForDifficulty(d || 5.0, w);
    return Math.max(1, Math.round((s / FACTOR) * (Math.pow(desiredRetention, 1.0 / decay) - 1)));
  }

  // --- Review (same interface as FSRS) ---

  function review(card, rating, now = new Date(), w = DEFAULT_W) {
    const isNew = card.state === 'new';
    const ALPHA = 0.3;
    let s, d, elapsed;

    // Compute predicted R before updating (for experiment logging)
    let predictedR;

    if (isNew) {
      predictedR = 0.9;
      s = initStability(rating, w);
      d = initDifficulty(rating, w);
      elapsed = 0;

      const interval = optimalInterval(s, d, _desiredRetention, w);
      const due = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

      const recalled = rating >= 2;
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
        // BetterFSRS extra state
        streak: recalled ? 1 : 0,
        difficultyEma: d,
        lastScheduledInterval: interval,
        errorEma: ALPHA * (predictedR - (recalled ? 1 : 0)),
        reviewsSinceLapse: recalled ? 100 : 0,
      };
    }

    // Non-new card
    elapsed = card.lastReview
      ? (now - new Date(card.lastReview)) / (1000 * 60 * 60 * 24)
      : 0;

    predictedR = predictRecall(elapsed, card, w);

    const rRaw = retrievabilityRaw(elapsed, card.stability, card.difficulty, w);
    d = nextDifficulty(card.difficulty, rating, card, w);

    // Update difficulty EMA
    const impliedD = initDifficulty(rating, w);
    const diffEma = 0.3 * impliedD + 0.7 * (card.difficultyEma || card.difficulty || 5.0);

    const recalled = rating >= 2;
    let streak, reviewsSinceLapse, lapses;

    if (recalled) {
      s = nextRecallStability(card.difficulty, card.stability, rRaw, rating, card, elapsed, w);
      streak = (card.streak || 0) + 1;
      reviewsSinceLapse = (card.reviewsSinceLapse || 100) + 1;
      lapses = card.lapses || 0;
    } else {
      s = nextForgetStability(card.difficulty, card.stability, rRaw, card, w);
      streak = 0;
      reviewsSinceLapse = 0;
      lapses = (card.lapses || 0) + 1;
    }

    const interval = optimalInterval(s, d, _desiredRetention, w);
    const due = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

    // Update error EMA
    const prevError = card.errorEma || 0;
    const errorEma = (1 - ALPHA) * prevError + ALPHA * (predictedR - (recalled ? 1 : 0));

    return {
      stability: s,
      difficulty: d,
      lastReview: now.toISOString(),
      due: due.toISOString(),
      interval: interval,
      reps: (card.reps || 0) + 1,
      lapses: lapses,
      state: 'review',
      predictedR: predictedR,
      // BetterFSRS extra state
      streak: streak,
      difficultyEma: diffEma,
      lastScheduledInterval: interval,
      errorEma: errorEma,
      reviewsSinceLapse: reviewsSinceLapse,
    };
  }

  /**
   * Preview what each rating would produce (same interface as FSRS.previewRatings).
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

  let _desiredRetention = 0.9;

  function setDesiredRetention(r) {
    _desiredRetention = Math.max(0.7, Math.min(0.97, r));
  }

  function getDesiredRetention() {
    return _desiredRetention;
  }

  return { review, previewRatings, predictRecall, retrievability, optimalInterval, setDesiredRetention, getDesiredRetention, DEFAULT_W };
})();

if (typeof module !== 'undefined') module.exports = BetterFSRS;
