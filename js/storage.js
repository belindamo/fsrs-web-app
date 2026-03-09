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

  function createCard(front, back) {
    const card = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      front,
      back,
      stability: 0,
      difficulty: 0,
      lastReview: null,
      due: new Date().toISOString(),
      interval: 0,
      reps: 0,
      lapses: 0,
      state: 'new',
      createdAt: new Date().toISOString(),
    };
    return saveCard(card);
  }

  // --- Due cards ---

  function getDueCards(now = new Date()) {
    return getCards().filter(c => new Date(c.due) <= now);
  }

  // --- Review history ---

  function getHistory() {
    return load(HISTORY_KEY);
  }

  function addReview(cardId, rating, elapsed, interval) {
    const history = getHistory();
    history.push({
      cardId,
      rating,
      elapsed,
      interval,
      timestamp: new Date().toISOString(),
    });
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

  // --- Export/Import ---
  function exportData() {
    return JSON.stringify({ cards: getCards(), history: getHistory() }, null, 2);
  }

  function importData(json) {
    const data = JSON.parse(json);
    if (data.cards) save(CARDS_KEY, data.cards);
    if (data.history) save(HISTORY_KEY, data.history);
  }

  return {
    getCards, getCard, saveCard, deleteCard, createCard,
    getDueCards, getHistory, addReview, removeLastReview, getStats,
    exportData, importData,
  };
})();

if (typeof module !== 'undefined') module.exports = Storage;
