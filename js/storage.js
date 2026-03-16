/**
 * Storage layer — wraps localStorage for cards and review history.
 */
const Storage = (() => {
  const CARDS_KEY = 'fsrs_cards';
  const HISTORY_KEY = 'fsrs_history';

  function load(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // --- Cards ---

  function getCards() {
    return load(CARDS_KEY);
  }

  function getCard(id) {
    return getCards().find(c => c.id === id) || null;
  }

  function saveCard(card) {
    const cards = getCards();
    const idx = cards.findIndex(c => c.id === card.id);
    if (idx >= 0) {
      cards[idx] = card;
    } else {
      cards.push(card);
    }
    save(CARDS_KEY, cards);
    return card;
  }

  function deleteCard(id) {
    const cards = getCards().filter(c => c.id !== id);
    save(CARDS_KEY, cards);
    // Also remove related history
    const history = getHistory().filter(h => h.cardId !== id);
    save(HISTORY_KEY, history);
  }

  function createCard(front, back, tags) {
    const algorithm = Math.random() < 0.5 ? 'fsrs5' : 'betterfsrs';
    const card = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      front,
      back,
      tags: Array.isArray(tags) ? tags.filter(t => t.length > 0) : [],
      algorithm,
      stability: 0,
      difficulty: 0,
      lastReview: null,
      due: new Date().toISOString(),
      interval: 0,
      reps: 0,
      lapses: 0,
      state: 'new',
      createdAt: new Date().toISOString(),
      // BetterFSRS extra state (initialized for all cards, only used by betterfsrs)
      streak: 0,
      difficultyEma: 5.0,
      lastScheduledInterval: 0,
      errorEma: 0,
      reviewsSinceLapse: 100,
    };
    return saveCard(card);
  }

  // --- Due cards ---

  function getDueCards(now = new Date(), tag) {
    let cards = getCards().filter(c => new Date(c.due) <= now);
    if (tag) {
      cards = cards.filter(c => Array.isArray(c.tags) && c.tags.includes(tag));
    }
    return cards;
  }

  function getDueCountByTag(now = new Date()) {
    const due = getCards().filter(c => new Date(c.due) <= now);
    const counts = {};
    due.forEach(c => {
      if (Array.isArray(c.tags)) {
        c.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
      }
    });
    return counts;
  }

  // --- Review history ---

  function getHistory() {
    return load(HISTORY_KEY);
  }

  function addReview(cardId, rating, elapsed, interval, algorithm, predictedR) {
    const history = getHistory();
    const entry = {
      cardId,
      rating,
      elapsed,
      interval,
      timestamp: new Date().toISOString(),
    };
    if (algorithm) entry.algorithm = algorithm;
    if (predictedR !== undefined) entry.predictedR = predictedR;
    history.push(entry);
    save(HISTORY_KEY, history);
  }

  function removeLastReview(cardId) {
    const history = getHistory();
    // Find the last review for this card and remove it
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].cardId === cardId) {
        history.splice(i, 1);
        break;
      }
    }
    save(HISTORY_KEY, history);
  }

  // --- Stats ---

  function getStats() {
    const cards = getCards();
    const history = getHistory();
    const now = new Date();
    const due = cards.filter(c => new Date(c.due) <= now).length;
    const newCards = cards.filter(c => c.state === 'new').length;
    const mature = cards.filter(c => c.state === 'review' && c.interval >= 21).length;
    const young = cards.filter(c => c.state === 'review' && c.interval < 21).length;

    // Reviews today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const reviewsToday = history.filter(h => new Date(h.timestamp) >= todayStart).length;

    // Streak: consecutive days with at least one review
    const daySet = new Set();
    history.forEach(h => {
      const d = new Date(h.timestamp);
      daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
    let streak = 0;
    const d = new Date(now);
    while (true) {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (daySet.has(key)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }

    return { total: cards.length, due, newCards, mature, young, reviewsToday, streak };
  }

  // --- Experiment stats ---

  function getExperimentStats() {
    const cards = getCards();
    const history = getHistory();

    const algoStats = {};
    ['fsrs5', 'betterfsrs'].forEach(algo => {
      const algoCards = cards.filter(c => c.algorithm === algo);
      const algoReviews = history.filter(h => h.algorithm === algo);
      const recalled = algoReviews.filter(h => h.rating >= 2).length;
      const total = algoReviews.length;
      const retention = total > 0 ? recalled / total : 0;

      // Mean predicted R (only for reviews that have it)
      const withPredR = algoReviews.filter(h => h.predictedR !== undefined);
      const meanPredR = withPredR.length > 0
        ? withPredR.reduce((sum, h) => sum + h.predictedR, 0) / withPredR.length
        : 0;

      // Mean interval
      const meanInterval = total > 0
        ? algoReviews.reduce((sum, h) => sum + (h.interval || 0), 0) / total
        : 0;

      algoStats[algo] = {
        cards: algoCards.length,
        reviews: total,
        recalled,
        retention,
        meanPredR,
        meanInterval,
      };
    });

    return algoStats;
  }

  // --- Export/Import ---
  function exportData() {
    return JSON.stringify({ cards: getCards(), history: getHistory() }, null, 2);
  }

  function importData(json) {
    const data = JSON.parse(json);
    if (data.cards) save(CARDS_KEY, data.cards);
    if (data.history) save(HISTORY_KEY, data.history);
  }

  function getCardHistory(cardId) {
    return getHistory().filter(h => h.cardId === cardId);
  }

  function getAllTags() {
    const tags = new Set();
    getCards().forEach(c => {
      if (Array.isArray(c.tags)) c.tags.forEach(t => tags.add(t));
    });
    return [...tags].sort((a, b) => a.localeCompare(b));
  }

  return {
    getCards, getCard, saveCard, deleteCard, createCard,
    getDueCards, getDueCountByTag, getHistory, getCardHistory, addReview, removeLastReview, getStats,
    getExperimentStats, exportData, importData, getAllTags,
  };
})();

if (typeof module !== 'undefined') module.exports = Storage;
