/**
 * FSRS adapter — wraps the official ts-fsrs library to match our app's interface.
 *
 * Expects ts-fsrs UMD to be loaded first (sets window.FSRS namespace).
 * This adapter captures that namespace, then exposes the same
 * review() / previewRatings() / retrievability() / nextInterval() API
 * that the rest of the app depends on.
 */
const FSRS = (() => {
  // Capture ts-fsrs namespace (set by UMD on window.FSRS)
  const lib = window.FSRS;
  if (!lib || !lib.fsrs) {
    console.error('ts-fsrs UMD not loaded — make sure ts-fsrs.umd.js is included before fsrs.js');
  }

  // Create schedulers — one at default 0.9 retention, recreated when desired retention changes
  let _desiredRetention = 0.9;
  let scheduler = lib.fsrs(lib.generatorParameters({
    enable_short_term: false,
    request_retention: _desiredRetention,
  }));

  /**
   * Update the desired retention used for scheduling.
   * Recreates the internal scheduler with the new target.
   */
  function setDesiredRetention(r) {
    r = Math.max(0.7, Math.min(0.97, r));
    if (r === _desiredRetention) return;
    _desiredRetention = r;
    scheduler = lib.fsrs(lib.generatorParameters({
      enable_short_term: false,
      request_retention: r,
    }));
  }

  function getDesiredRetention() {
    return _desiredRetention;
  }

  const DECAY = -0.5;
  const FACTOR = 19 / 81; // (0.9^(1/DECAY) - 1)

  /**
   * Convert our app's card format to a ts-fsrs Card object.
   */
  function toTsCard(card, now) {
    const isNew = card.state === 'new';
    const elapsed = (!isNew && card.lastReview)
      ? (now - new Date(card.lastReview)) / (1000 * 60 * 60 * 24)
      : 0;

    return {
      due: isNew ? now : new Date(card.due),
      stability: card.stability || 0,
      difficulty: card.difficulty || 0,
      elapsed_days: elapsed,
      scheduled_days: card.interval || 0,
      reps: card.reps || 0,
      lapses: card.lapses || 0,
      learning_steps: 0,
      state: isNew ? lib.State.New : lib.State.Review,
      last_review: card.lastReview ? new Date(card.lastReview) : undefined,
    };
  }

  /**
   * Retrievability — probability of recall after `elapsed` days with stability `s`.
   */
  function retrievability(elapsed, s) {
    if (s <= 0) return 0;
    return Math.pow(1 + FACTOR * elapsed / s, DECAY);
  }

  /**
   * Schedule the next review interval from stability.
   */
  function nextInterval(s, desiredRetention = 0.9) {
    const interval = (s / FACTOR) * (Math.pow(desiredRetention, 1 / DECAY) - 1);
    return Math.max(Math.round(interval), 1);
  }

  /**
   * Process a review and return the updated card state.
   *
   * card: { stability, difficulty, lastReview (ISO), reps, lapses, state }
   * rating: 1-4 (Again, Hard, Good, Easy)
   * now: Date
   *
   * Returns the same shape our app expects.
   */
  function review(card, rating, now = new Date()) {
    const isNew = card.state === 'new';
    const tsCard = toTsCard(card, now);

    // Compute predicted retrievability before the review
    let predictedR;
    if (isNew) {
      predictedR = 0.9;
    } else {
      const elapsed = (now - new Date(card.lastReview)) / (1000 * 60 * 60 * 24);
      predictedR = retrievability(elapsed, card.stability);
    }

    // ts-fsrs repeat() returns results keyed by rating (1-4)
    const results = scheduler.repeat(tsCard, now);
    const result = results[rating];
    const next = result.card;

    return {
      stability: next.stability,
      difficulty: next.difficulty,
      lastReview: now.toISOString(),
      due: new Date(next.due).toISOString(),
      interval: next.scheduled_days,
      reps: next.reps,
      lapses: next.lapses,
      state: 'review',
      predictedR: predictedR,
    };
  }

  /**
   * Given current card state, preview what each rating would produce.
   */
  function previewRatings(card, now = new Date()) {
    const tsCard = toTsCard(card, now);
    const results = scheduler.repeat(tsCard, now);

    const labels = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
    const preview = {};
    for (let r = 1; r <= 4; r++) {
      const next = results[r].card;
      preview[r] = {
        label: labels[r],
        interval: next.scheduled_days,
        due: new Date(next.due).toISOString(),
      };
    }
    return preview;
  }

  return { review, previewRatings, retrievability, nextInterval, setDesiredRetention, getDesiredRetention, _lib: lib, _scheduler: scheduler };
})();

if (typeof module !== 'undefined') module.exports = FSRS;
