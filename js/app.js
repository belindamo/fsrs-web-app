/**
 * Main application logic — manages views and user interactions.
 */
const App = (() => {
  let currentView = 'dashboard';
  let reviewQueue = [];
  let currentCard = null;
  let answerRevealed = false;
  let cardSearchQuery = '';
  let cardFilterState = 'all';
  let createMode = 'single';
  let sessionRatings = []; // Track ratings for session summary

  // --- DOM helpers ---

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function show(id) {
    $$('.view').forEach(v => v.classList.remove('active'));
    const el = $(`#${id}`);
    if (el) el.classList.add('active');
    currentView = id;
    // Update nav
    $$('nav button').forEach(b => b.classList.remove('selected'));
    const navBtn = $(`[data-view="${id}"]`);
    if (navBtn) navBtn.classList.add('selected');
  }

  // --- Dashboard ---

  function renderDashboard() {
    const stats = Storage.getStats();
    $('#stat-total').textContent = stats.total;
    $('#stat-due').textContent = stats.due;
    $('#stat-new').textContent = stats.newCards;
    $('#stat-reviews-today').textContent = stats.reviewsToday;
    $('#stat-streak').textContent = stats.streak;
    $('#stat-mature').textContent = stats.mature;

    const startBtn = $('#start-review-btn');
    if (stats.due > 0) {
      startBtn.textContent = `Review ${stats.due} card${stats.due > 1 ? 's' : ''}`;
      startBtn.disabled = false;
    } else {
      startBtn.textContent = 'No cards due';
      startBtn.disabled = true;
    }
  }

  // --- Create card ---

  function handleCreateCard(e) {
    e.preventDefault();
    const front = $('#card-front').value.trim();
    const back = $('#card-back').value.trim();
    if (!front || !back) return;

    Storage.createCard(front, back);
    $('#card-front').value = '';
    $('#card-back').value = '';
    renderDashboard();
    renderCardList();

    // Show toast
    showToast('Card created!');
  }

  // --- Bulk create ---

  function parseBulkInput(text) {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const sep = line.indexOf('::');
        if (sep === -1) return null;
        const front = line.slice(0, sep).trim();
        const back = line.slice(sep + 2).trim();
        if (!front || !back) return null;
        return { front, back };
      })
      .filter(Boolean);
  }

  function updateBulkPreview() {
    const input = $('#bulk-input').value;
    const parsed = parseBulkInput(input);
    const lines = input.split('\n').filter(l => l.trim().length > 0);
    const invalid = lines.length - parsed.length;

    const previewEl = $('#bulk-preview');
    const btn = $('#bulk-create-btn');

    if (lines.length === 0) {
      previewEl.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Create Cards';
      return;
    }

    let msg = `${parsed.length} card${parsed.length !== 1 ? 's' : ''} ready`;
    if (invalid > 0) {
      msg += ` · ${invalid} line${invalid !== 1 ? 's' : ''} skipped (missing ::)`;
    }
    previewEl.textContent = msg;
    btn.disabled = parsed.length === 0;
    btn.textContent = parsed.length > 0 ? `Create ${parsed.length} Card${parsed.length !== 1 ? 's' : ''}` : 'Create Cards';
  }

  function handleBulkCreate() {
    const parsed = parseBulkInput($('#bulk-input').value);
    if (parsed.length === 0) return;

    parsed.forEach(card => Storage.createCard(card.front, card.back));

    const count = parsed.length;
    $('#bulk-input').value = '';
    updateBulkPreview();
    renderDashboard();
    renderCardList();
    showToast(`${count} card${count !== 1 ? 's' : ''} created!`);
  }

  function switchCreateMode(mode) {
    createMode = mode;
    $$('.create-tab').forEach(t => t.classList.remove('selected'));
    $(`[data-mode="${mode}"]`).classList.add('selected');

    if (mode === 'single') {
      $('#create-single').classList.remove('hidden');
      $('#create-bulk').classList.add('hidden');
    } else {
      $('#create-single').classList.add('hidden');
      $('#create-bulk').classList.remove('hidden');
    }
  }

  // --- Review ---

  function startReview() {
    reviewQueue = Storage.getDueCards();
    if (reviewQueue.length === 0) return;
    sessionRatings = [];
    // Show active review, hide summary
    $('#review-active').classList.remove('hidden');
    $('#review-summary').classList.add('hidden');
    showNextCard();
    show('review');
  }

  function showNextCard() {
    if (reviewQueue.length === 0) {
      finishReview();
      return;
    }
    currentCard = reviewQueue[0];
    answerRevealed = false;

    $('#review-front').textContent = currentCard.front;
    $('#review-back').textContent = '';
    $('#review-back').classList.add('hidden');
    $('#show-answer-btn').classList.remove('hidden');
    $('#rating-buttons').classList.add('hidden');
    $('#review-progress').textContent = `${reviewQueue.length} card${reviewQueue.length > 1 ? 's' : ''} remaining`;

    // Show preview intervals
    const preview = FSRS.previewRatings(currentCard);
    for (let r = 1; r <= 4; r++) {
      const btn = $(`[data-rating="${r}"]`);
      if (btn) {
        const days = preview[r].interval;
        btn.querySelector('.interval-hint').textContent = formatInterval(days);
      }
    }
  }

  function revealAnswer() {
    answerRevealed = true;
    $('#review-back').textContent = currentCard.back;
    $('#review-back').classList.remove('hidden');
    $('#show-answer-btn').classList.add('hidden');
    $('#rating-buttons').classList.remove('hidden');
  }

  function handleRating(rating) {
    if (!currentCard) return;

    const now = new Date();
    const elapsed = currentCard.lastReview
      ? (now - new Date(currentCard.lastReview)) / (1000 * 60 * 60 * 24)
      : 0;

    const updated = FSRS.review(currentCard, rating, now);
    const merged = { ...currentCard, ...updated };
    Storage.saveCard(merged);
    Storage.addReview(currentCard.id, rating, elapsed, updated.interval);
    sessionRatings.push(rating);

    reviewQueue.shift();
    showNextCard();
  }

  function finishReview() {
    if (sessionRatings.length === 0) {
      show('dashboard');
      renderDashboard();
      return;
    }
    showSessionSummary();
  }

  function showSessionSummary() {
    // Hide the active review UI, show summary
    $('#review-active').classList.add('hidden');
    $('#review-summary').classList.remove('hidden');

    // Count ratings
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    sessionRatings.forEach(r => { counts[r]++; });

    $('#summary-total').textContent = sessionRatings.length;
    $('#summary-again-count').textContent = counts[1];
    $('#summary-hard-count').textContent = counts[2];
    $('#summary-good-count').textContent = counts[3];
    $('#summary-easy-count').textContent = counts[4];
  }

  function dismissSummary() {
    show('dashboard');
    renderDashboard();
  }

  // --- Card list ---

  function getCardState(card) {
    if (card.state === 'new') return 'new';
    return card.interval >= 21 ? 'mature' : 'young';
  }

  function isCardDue(card) {
    return new Date(card.due) <= new Date();
  }

  function filterCards(cards) {
    let filtered = cards;

    // Apply state filter
    if (cardFilterState === 'due') {
      filtered = filtered.filter(isCardDue);
    } else if (cardFilterState === 'new') {
      filtered = filtered.filter(c => c.state === 'new');
    } else if (cardFilterState === 'young') {
      filtered = filtered.filter(c => c.state === 'review' && c.interval < 21);
    } else if (cardFilterState === 'mature') {
      filtered = filtered.filter(c => c.state === 'review' && c.interval >= 21);
    }

    // Apply search query
    if (cardSearchQuery) {
      const q = cardSearchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)
      );
    }

    return filtered;
  }

  function renderCardList() {
    const allCards = Storage.getCards();
    const filtered = filterCards(allCards);
    const list = $('#card-list');
    const countEl = $('#card-count');
    list.innerHTML = '';

    // Update count
    if (allCards.length === 0) {
      countEl.textContent = '';
    } else if (filtered.length === allCards.length) {
      countEl.textContent = `${allCards.length} card${allCards.length !== 1 ? 's' : ''}`;
    } else {
      countEl.textContent = `${filtered.length} of ${allCards.length} card${allCards.length !== 1 ? 's' : ''}`;
    }

    if (allCards.length === 0) {
      list.innerHTML = '<p class="empty-state">No cards yet. Create one above!</p>';
      return;
    }

    if (filtered.length === 0) {
      list.innerHTML = '<p class="empty-state">No cards match your search.</p>';
      return;
    }

    filtered.forEach(card => {
      const row = document.createElement('div');
      row.className = 'card-row';
      row.setAttribute('data-testid', 'card-row');

      const state = getCardState(card);
      const stateClass = state === 'new' ? 'badge-new' : state === 'mature' ? 'badge-mature' : 'badge-young';
      const stateLabel = state === 'new' ? 'New' : state === 'mature' ? 'Mature' : 'Young';

      row.innerHTML = `
        <div class="card-row-content">
          <strong>${escapeHtml(card.front)}</strong>
          <span class="badge ${stateClass}">${stateLabel}</span>
        </div>
        <div class="card-row-meta">
          ${card.state !== 'new' ? `Next: ${new Date(card.due).toLocaleDateString()} · Interval: ${formatInterval(card.interval)}` : 'Not yet reviewed'}
        </div>
        <button class="btn-icon edit-card-btn" data-id="${card.id}" data-testid="edit-card" aria-label="Edit card">✎</button>
        <button class="btn-icon delete-card-btn" data-id="${card.id}" data-testid="delete-card" aria-label="Delete card">✕</button>
      `;
      list.appendChild(row);
    });
  }

  // --- Stats view ---

  function renderStats() {
    const history = Storage.getHistory();
    const stats = Storage.getStats();

    $('#stats-total-reviews').textContent = history.length;
    $('#stats-total-cards').textContent = stats.total;
    $('#stats-mature-cards').textContent = stats.mature;
    $('#stats-young-cards').textContent = stats.young;

    // Rating distribution
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0 };
    history.forEach(h => { dist[h.rating] = (dist[h.rating] || 0) + 1; });
    const maxDist = Math.max(...Object.values(dist), 1);

    const distEl = $('#rating-distribution');
    distEl.innerHTML = '';
    const labels = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
    const colors = { 1: '#ef4444', 2: '#f59e0b', 3: '#22c55e', 4: '#3b82f6' };
    for (let r = 1; r <= 4; r++) {
      const pct = history.length > 0 ? Math.round(dist[r] / history.length * 100) : 0;
      distEl.innerHTML += `
        <div class="dist-row">
          <span class="dist-label">${labels[r]}</span>
          <div class="dist-bar-track">
            <div class="dist-bar" style="width:${(dist[r]/maxDist)*100}%;background:${colors[r]}"></div>
          </div>
          <span class="dist-value">${dist[r]} (${pct}%)</span>
        </div>
      `;
    }

    // Reviews per day (last 14 days)
    renderReviewChart(history);
  }

  function renderReviewChart(history) {
    const canvas = $('#review-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = 160;

    ctx.clearRect(0, 0, w, h);

    const days = 14;
    const counts = new Array(days).fill(0);
    const now = new Date();
    history.forEach(r => {
      const diff = Math.floor((now - new Date(r.timestamp)) / (1000 * 60 * 60 * 24));
      if (diff < days) counts[days - 1 - diff]++;
    });

    const maxCount = Math.max(...counts, 1);
    const barWidth = (w - 40) / days;
    const padding = 20;

    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';

    for (let i = 0; i < days; i++) {
      const barH = (counts[i] / maxCount) * (h - 40);
      const x = padding + i * barWidth;
      const y = h - 20 - barH;

      ctx.fillStyle = '#6366f1';
      ctx.fillRect(x + 2, y, barWidth - 4, barH);

      // Day label
      const date = new Date(now);
      date.setDate(date.getDate() - (days - 1 - i));
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${date.getMonth() + 1}/${date.getDate()}`, x + barWidth / 2, h - 4);

      // Count label
      if (counts[i] > 0) {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(counts[i], x + barWidth / 2, y - 4);
      }
    }
  }

  // --- Edit modal ---

  function openEditModal(cardId) {
    const card = Storage.getCard(cardId);
    if (!card) return;
    $('#edit-card-id').value = card.id;
    $('#edit-front').value = card.front;
    $('#edit-back').value = card.back;
    $('#edit-modal').classList.remove('hidden');
    $('#edit-front').focus();
  }

  function closeEditModal() {
    $('#edit-modal').classList.add('hidden');
  }

  // --- Utilities ---

  function formatInterval(days) {
    if (days < 1) return '< 1d';
    if (days < 30) return `${days}d`;
    if (days < 365) return `${Math.round(days / 30)}mo`;
    return `${(days / 365).toFixed(1)}y`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(msg) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // --- Init ---

  function init() {
    // Nav
    $$('nav button').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        show(view);
        if (view === 'dashboard') renderDashboard();
        if (view === 'cards') renderCardList();
        if (view === 'create') {}
        if (view === 'stats') renderStats();
      });
    });

    // Create mode tabs
    $$('.create-tab').forEach(tab => {
      tab.addEventListener('click', () => switchCreateMode(tab.dataset.mode));
    });

    // Create form (single)
    $('#create-form').addEventListener('submit', handleCreateCard);

    // Bulk create
    $('#bulk-input').addEventListener('input', updateBulkPreview);
    $('#bulk-create-btn').addEventListener('click', handleBulkCreate);

    // Review
    $('#start-review-btn').addEventListener('click', startReview);
    $('#show-answer-btn').addEventListener('click', revealAnswer);
    $$('[data-rating]').forEach(btn => {
      btn.addEventListener('click', () => handleRating(parseInt(btn.dataset.rating)));
    });
    $('#summary-done-btn').addEventListener('click', dismissSummary);

    // Card list actions (delegated)
    $('#card-list').addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.delete-card-btn');
      if (deleteBtn) {
        Storage.deleteCard(deleteBtn.dataset.id);
        renderCardList();
        renderDashboard();
        showToast('Card deleted');
        return;
      }

      const editBtn = e.target.closest('.edit-card-btn');
      if (editBtn) {
        openEditModal(editBtn.dataset.id);
      }
    });

    // Edit modal
    $('#edit-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = $('#edit-card-id').value;
      const front = $('#edit-front').value.trim();
      const back = $('#edit-back').value.trim();
      if (!front || !back) return;

      const card = Storage.getCard(id);
      if (card) {
        card.front = front;
        card.back = back;
        Storage.saveCard(card);
        closeEditModal();
        renderCardList();
        showToast('Card updated');
      }
    });

    $('#edit-cancel-btn').addEventListener('click', closeEditModal);
    $('#edit-modal .modal-backdrop').addEventListener('click', closeEditModal);

    // Card search & filter
    $('#card-search').addEventListener('input', (e) => {
      cardSearchQuery = e.target.value;
      renderCardList();
    });

    $$('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        $$('.filter-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        cardFilterState = pill.dataset.filter;
        renderCardList();
      });
    });

    // Export/Import
    $('#export-btn')?.addEventListener('click', () => {
      const data = Storage.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'fsrs-backup.json';
      a.click();
    });

    $('#import-btn')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            Storage.importData(ev.target.result);
            renderDashboard();
            renderCardList();
            showToast('Data imported!');
          } catch {
            showToast('Invalid file');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    // Keyboard shortcuts for review
    document.addEventListener('keydown', (e) => {
      // Only active during review view
      if (currentView !== 'review') return;
      // Don't intercept when typing in inputs
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

      if (!answerRevealed && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        revealAnswer();
      } else if (answerRevealed) {
        const keyMap = { '1': 1, '2': 2, '3': 3, '4': 4 };
        const rating = keyMap[e.key];
        if (rating) {
          e.preventDefault();
          handleRating(rating);
        }
      }
    });

    // Initial render
    renderDashboard();
    show('dashboard');
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
