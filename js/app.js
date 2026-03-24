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
  let cardSortOrder = 'created-desc';
  let tagFilter = ''; // empty means all
  let createMode = 'single';
  let previewVisible = false;
  let sessionRatings = []; // Track ratings for session summary
  let expandedCardId = null; // Currently expanded card in card list
  let undoStack = []; // Stack of {cardSnapshot, rating} for undo during review
  let reviewTagFilter = ''; // Tag filter for review sessions (empty = all)
  let sessionStartTime = null; // Timestamp when review session started
  let cardStartTime = null; // Timestamp when current card was shown
  let cardTimes = []; // Array of per-card review times in ms

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

  function getEffectiveDueCount(tag) {
    const allDue = Storage.getDueCards(new Date(), tag || undefined);
    const settings = Storage.getSettings();
    const introduced = Storage.getNewCardsIntroducedToday();
    const remaining = Math.max(0, settings.newCardsPerDay - introduced);
    const newCards = allDue.filter(c => c.state === 'new');
    const reviewCards = allDue.filter(c => c.state !== 'new');
    return reviewCards.length + Math.min(newCards.length, remaining);
  }

  function renderDashboard() {
    const stats = Storage.getStats();
    $('#stat-total').textContent = stats.total;
    $('#stat-due').textContent = stats.due;
    $('#stat-new').textContent = stats.newCards;
    $('#stat-reviews-today').textContent = stats.reviewsToday;
    $('#stat-streak').textContent = stats.streak;
    $('#stat-mature').textContent = stats.mature;

    renderDashboardTagFilter();

    // Count effective due cards (respecting new-card-per-day limit)
    const effectiveDue = getEffectiveDueCount(reviewTagFilter);

    const startBtn = $('#start-review-btn');
    if (effectiveDue > 0) {
      const tagLabel = reviewTagFilter ? ` [${reviewTagFilter}]` : '';
      startBtn.textContent = `Review ${effectiveDue} card${effectiveDue > 1 ? 's' : ''}${tagLabel}`;
      startBtn.disabled = false;
    } else {
      startBtn.textContent = reviewTagFilter ? `No ${reviewTagFilter} cards due` : 'No cards due';
      startBtn.disabled = true;
    }
  }

  function renderDashboardTagFilter() {
    const container = $('#dashboard-tag-filter');
    if (!container) return;

    const allTags = Storage.getAllTags();
    const dueCounts = Storage.getDueCountByTag();

    // Only show if there are tags with due cards, or if a filter is active
    const tagsWithDue = allTags.filter(t => (dueCounts[t] || 0) > 0);
    if (tagsWithDue.length === 0 && !reviewTagFilter) {
      container.classList.add('hidden');
      container.innerHTML = '';
      return;
    }

    container.classList.remove('hidden');
    let html = '<span class="dashboard-filter-label">Review by tag</span>';
    html += `<button class="dashboard-tag-pill${reviewTagFilter === '' ? ' selected' : ''}" data-tag="" data-testid="review-tag-all">All</button>`;
    allTags.forEach(tag => {
      const count = dueCounts[tag] || 0;
      const sel = reviewTagFilter === tag ? ' selected' : '';
      const countBadge = count > 0 ? ` <span class="tag-due-count">${count}</span>` : '';
      html += `<button class="dashboard-tag-pill${sel}" data-tag="${escapeHtml(tag)}" data-testid="review-tag-pill">${escapeHtml(tag)}${countBadge}</button>`;
    });
    container.innerHTML = html;
  }

  // --- Create card ---

  function parseTags(str) {
    return str.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
  }

  function tagColorClass(tag) {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = ((hash << 5) - hash) + tag.charCodeAt(i);
    return 'tag-pill-color-' + (Math.abs(hash) % 8);
  }

  function handleCreateCard(e) {
    e.preventDefault();
    const front = $('#card-front').value.trim();
    const back = $('#card-back').value.trim();
    if (!front || !back) return;

    const tags = parseTags($('#card-tags')?.value || '');
    Storage.createCard(front, back, tags);
    $('#card-front').value = '';
    $('#card-back').value = '';
    if ($('#card-tags')) $('#card-tags').value = '';
    updatePreview();
    renderDashboard();
    renderCardList();

    showToast('Card created!');
  }

  // --- Bulk create ---

  function parseBulkInput(text) {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.split('::');
        if (parts.length < 2) return null;
        const front = parts[0].trim();
        const back = parts[1].trim();
        if (!front || !back) return null;
        const tags = parts.length >= 3 ? parseTags(parts[2]) : [];
        return { front, back, tags };
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

    parsed.forEach(card => Storage.createCard(card.front, card.back, card.tags));

    const count = parsed.length;
    $('#bulk-input').value = '';
    updateBulkPreview();
    renderDashboard();
    renderCardList();
    showToast(`${count} card${count !== 1 ? 's' : ''} created!`);
  }

  // --- Create preview ---

  function togglePreview() {
    previewVisible = !previewVisible;
    const previewEl = $('#create-preview');
    const toggleBtn = $('#preview-toggle-btn');
    if (previewVisible) {
      previewEl.classList.remove('hidden');
      toggleBtn.textContent = 'Hide Preview';
      updatePreview();
    } else {
      previewEl.classList.add('hidden');
      toggleBtn.textContent = 'Preview';
    }
  }

  function updatePreview() {
    if (!previewVisible) return;
    const front = $('#card-front').value.trim();
    const back = $('#card-back').value.trim();
    const frontEl = $('#preview-front');
    const backEl = $('#preview-back');

    if (front) {
      renderMarkdown(frontEl, front);
    } else {
      frontEl.innerHTML = '<span style="color:var(--text-muted)">Front side</span>';
    }

    if (back) {
      renderMarkdown(backEl, back);
    } else {
      backEl.innerHTML = '<span style="color:var(--text-muted)">Back side</span>';
    }
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
    const allDue = Storage.getDueCards(new Date(), reviewTagFilter || undefined);
    if (allDue.length === 0) return;

    // Apply new-cards-per-day limit
    const settings = Storage.getSettings();
    const introduced = Storage.getNewCardsIntroducedToday();
    const remaining = Math.max(0, settings.newCardsPerDay - introduced);
    const newCards = allDue.filter(c => c.state === 'new').slice(0, remaining);
    const reviewCards = allDue.filter(c => c.state !== 'new');
    reviewQueue = [...reviewCards, ...newCards];

    if (reviewQueue.length === 0) return;
    sessionRatings = [];
    undoStack = [];
    cardTimes = [];
    sessionStartTime = Date.now();
    cardStartTime = null;
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
    cardStartTime = Date.now();

    renderMarkdown($('#review-front'), currentCard.front);
    $('#review-back').innerHTML = '';
    $('#review-back').classList.add('hidden');
    $('#show-answer-btn').classList.remove('hidden');
    $('#rating-buttons').classList.add('hidden');
    const tagLabel = reviewTagFilter ? ` · ${reviewTagFilter}` : '';
    $('#review-progress').textContent = `${reviewQueue.length} card${reviewQueue.length > 1 ? 's' : ''} remaining${tagLabel}`;

    // Show/hide undo button
    const undoBtn = $('#undo-btn');
    if (undoBtn) {
      if (undoStack.length > 0) {
        undoBtn.classList.remove('hidden');
      } else {
        undoBtn.classList.add('hidden');
      }
    }

    // Show preview intervals (use the card's assigned algorithm)
    const algo = getAlgorithm(currentCard);
    const preview = algo.previewRatings(currentCard);
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
    renderMarkdown($('#review-back'), currentCard.back);
    $('#review-back').classList.remove('hidden');
    $('#show-answer-btn').classList.add('hidden');
    $('#rating-buttons').classList.remove('hidden');
  }

  function getAlgorithm(card) {
    return card.algorithm === 'betterfsrs' ? BetterFSRS : FSRS;
  }

  function handleRating(rating) {
    if (!currentCard) return;

    // Save snapshot for undo before modifying anything
    const cardSnapshot = { ...currentCard };
    const wasNew = currentCard.state === 'new';

    const now = new Date();
    const elapsed = currentCard.lastReview
      ? (now - new Date(currentCard.lastReview)) / (1000 * 60 * 60 * 24)
      : 0;

    const algo = getAlgorithm(currentCard);
    const updated = algo.review(currentCard, rating, now);
    const merged = { ...currentCard, ...updated };
    Storage.saveCard(merged);

    // Log with algorithm and predictedR for experiment tracking
    const predictedR = updated.predictedR !== undefined ? updated.predictedR : undefined;
    Storage.addReview(currentCard.id, rating, elapsed, updated.interval, currentCard.algorithm, predictedR);
    sessionRatings.push(rating);

    // Record per-card review time
    if (cardStartTime) {
      cardTimes.push(Date.now() - cardStartTime);
    }

    // Track new card introductions for daily limit
    if (wasNew) {
      Storage.incrementNewCardsToday();
    }

    // Push to undo stack
    undoStack.push({ cardSnapshot, rating, wasNew });

    // Leech detection: if rating was Again and lapses hit threshold, auto-suspend
    const settings = Storage.getSettings();
    if (rating === 1 && settings.leechThreshold > 0) {
      const freshCard = Storage.getCard(currentCard.id);
      if (freshCard && (freshCard.lapses || 0) >= settings.leechThreshold && !freshCard.suspended) {
        Storage.suspendCard(freshCard.id);
        showToast(`Leech detected! Card suspended (${freshCard.lapses} lapses)`);
      }
    }

    // Advance to next card
    reviewQueue.shift();
    showNextCard();
  }

  function undoLastRating() {
    if (undoStack.length === 0) return;
    const last = undoStack.pop();

    // Restore the card to its pre-rating state
    Storage.saveCard(last.cardSnapshot);

    // Remove the last review from history
    Storage.removeLastReview(last.cardSnapshot.id);

    // Remove last session rating and card time
    sessionRatings.pop();
    cardTimes.pop();

    // Decrement counter if this was a new card
    if (last.wasNew) {
      Storage.decrementNewCardsToday();
    }

    // Put the card back at the front of the review queue
    reviewQueue.unshift(last.cardSnapshot);

    // If we were on the summary screen, go back to active review
    if (!$('#review-summary').classList.contains('hidden')) {
      $('#review-active').classList.remove('hidden');
      $('#review-summary').classList.add('hidden');
    }

    showNextCard();
    showToast('Rating undone');
  }

  function finishReview() {
    if (sessionRatings.length === 0) {
      show('dashboard');
      renderDashboard();
      return;
    }
    showSessionSummary();
  }

  function formatDuration(ms) {
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
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

    // Session timing stats
    const sessionElapsed = sessionStartTime ? Date.now() - sessionStartTime : 0;
    const avgTime = cardTimes.length > 0
      ? cardTimes.reduce((a, b) => a + b, 0) / cardTimes.length
      : 0;
    const fastest = cardTimes.length > 0 ? Math.min(...cardTimes) : 0;
    const slowest = cardTimes.length > 0 ? Math.max(...cardTimes) : 0;

    const durationEl = $('#summary-duration');
    if (durationEl) durationEl.textContent = formatDuration(sessionElapsed);

    const avgEl = $('#summary-avg-time');
    if (avgEl) avgEl.textContent = formatDuration(avgTime);

    const fastEl = $('#summary-fastest');
    if (fastEl) fastEl.textContent = formatDuration(fastest);

    const slowEl = $('#summary-slowest');
    if (slowEl) slowEl.textContent = formatDuration(slowest);

    // Show/hide undo button on summary screen
    const summaryUndo = $('#summary-undo-btn');
    if (summaryUndo) {
      if (undoStack.length > 0) {
        summaryUndo.classList.remove('hidden');
      } else {
        summaryUndo.classList.add('hidden');
      }
    }
  }

  function dismissSummary() {
    show('dashboard');
    renderDashboard();
  }

  // --- Card list ---

  function getCardState(card) {
    if (card.suspended) return 'suspended';
    if (card.state === 'new') return 'new';
    return card.interval >= 21 ? 'mature' : 'young';
  }

  function isLeech(card) {
    const settings = Storage.getSettings();
    return settings.leechThreshold > 0 && (card.lapses || 0) >= settings.leechThreshold;
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
    } else if (cardFilterState === 'suspended') {
      filtered = filtered.filter(c => c.suspended);
    }

    // Apply tag filter
    if (tagFilter) {
      filtered = filtered.filter(c =>
        Array.isArray(c.tags) && c.tags.includes(tagFilter)
      );
    }

    // Apply search query
    if (cardSearchQuery) {
      const q = cardSearchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q) ||
        (Array.isArray(c.tags) && c.tags.some(t => t.includes(q)))
      );
    }

    return filtered;
  }

  function sortCards(cards) {
    const sorted = [...cards];
    switch (cardSortOrder) {
      case 'created-desc':
        sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'created-asc':
        sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'due-asc':
        sorted.sort((a, b) => new Date(a.due) - new Date(b.due));
        break;
      case 'alpha-asc':
        sorted.sort((a, b) => a.front.localeCompare(b.front));
        break;
      case 'alpha-desc':
        sorted.sort((a, b) => b.front.localeCompare(a.front));
        break;
      case 'stability-asc':
        sorted.sort((a, b) => (a.stability || 0) - (b.stability || 0));
        break;
      case 'interval-asc':
        sorted.sort((a, b) => (a.interval || 0) - (b.interval || 0));
        break;
      default:
        break;
    }
    return sorted;
  }

  function renderTagFilters() {
    const allTags = Storage.getAllTags();
    const container = $('#tag-filters');
    if (!container) return;

    if (allTags.length === 0) {
      container.classList.add('hidden');
      container.innerHTML = '';
      tagFilter = '';
      return;
    }

    container.classList.remove('hidden');
    let html = '<span class="tag-filter-label">Tags</span>';
    html += `<button class="tag-filter-pill${tagFilter === '' ? ' selected' : ''}" data-tag="" data-testid="tag-filter-all">All</button>`;
    allTags.forEach(tag => {
      const sel = tagFilter === tag ? ' selected' : '';
      html += `<button class="tag-filter-pill${sel}" data-tag="${escapeHtml(tag)}" data-testid="tag-filter-pill">${escapeHtml(tag)}</button>`;
    });
    container.innerHTML = html;
  }

  function renderCardList() {
    const allCards = Storage.getCards();
    renderTagFilters();
    const filtered = sortCards(filterCards(allCards));
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
      const isExpanded = expandedCardId === card.id;
      row.className = 'card-row' + (isExpanded ? ' expanded' : '') + (card.suspended ? ' suspended' : '');
      row.setAttribute('data-testid', 'card-row');
      row.setAttribute('data-card-id', card.id);

      const state = getCardState(card);
      const stateMap = {
        'new': { cls: 'badge-new', label: 'New' },
        'young': { cls: 'badge-young', label: 'Young' },
        'mature': { cls: 'badge-mature', label: 'Mature' },
        'suspended': { cls: 'badge-suspended', label: 'Suspended' },
      };
      const { cls: stateClass, label: stateLabel } = stateMap[state] || stateMap['young'];
      const leechBadge = isLeech(card) ? ' <span class="badge badge-leech" data-testid="badge-leech">Leech</span>' : '';

      const chevron = isExpanded ? '▾' : '▸';

      let detailHtml = '';
      if (isExpanded) {
        const reviews = Storage.getCardHistory(card.id);
        let timelineHtml = '';
        if (reviews.length > 0) {
          const timelineRows = reviews.map(r => {
            const ratingLabels = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
            const ratingColors = { 1: '#ef4444', 2: '#f59e0b', 3: '#22c55e', 4: '#3b82f6' };
            const label = ratingLabels[r.rating] || '?';
            const color = ratingColors[r.rating] || 'var(--text-muted)';
            const date = new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const time = new Date(r.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            const predR = r.predictedR !== undefined ? `${(r.predictedR * 100).toFixed(0)}%` : '—';
            const ivl = r.interval ? formatInterval(r.interval) : '—';
            return `<div class="timeline-row" data-testid="timeline-row">
              <span class="timeline-date">${date} ${time}</span>
              <span class="timeline-rating" style="color:${color}">${label}</span>
              <span class="timeline-predr" title="Predicted recall">R: ${predR}</span>
              <span class="timeline-ivl" title="New interval">→ ${ivl}</span>
            </div>`;
          }).join('');
          timelineHtml = `
            <div class="card-detail-timeline" data-testid="card-timeline">
              <span class="card-detail-label">Review History</span>
              <div class="timeline-list">${timelineRows}</div>
            </div>`;
        } else {
          timelineHtml = `
            <div class="card-detail-timeline" data-testid="card-timeline">
              <span class="card-detail-label">Review History</span>
              <p class="timeline-empty" data-testid="timeline-empty">No reviews yet</p>
            </div>`;
        }

        const suspendBtnLabel = card.suspended ? 'Unsuspend' : 'Suspend';
        const suspendBtnAction = card.suspended ? 'unsuspend' : 'suspend';
        detailHtml = `
          <div class="card-detail" data-testid="card-detail">
            <div class="card-detail-answer">
              <span class="card-detail-label">Answer</span>
              <div class="card-detail-value md-content" data-testid="card-detail-answer">${Markdown.render(card.back)}</div>
            </div>
            <div class="card-detail-meta">
              <div class="detail-chip"><span class="detail-chip-label">Interval</span><span class="detail-chip-value">${card.state !== 'new' ? formatInterval(card.interval) : '—'}</span></div>
              <div class="detail-chip"><span class="detail-chip-label">Reps</span><span class="detail-chip-value">${card.reps || 0}</span></div>
              <div class="detail-chip"><span class="detail-chip-label">Lapses</span><span class="detail-chip-value">${card.lapses || 0}</span></div>
              <div class="detail-chip"><span class="detail-chip-label">Stability</span><span class="detail-chip-value">${card.stability > 0 ? card.stability.toFixed(1) : '—'}</span></div>
              <div class="detail-chip"><span class="detail-chip-label">Difficulty</span><span class="detail-chip-value">${card.difficulty > 0 ? card.difficulty.toFixed(1) : '—'}</span></div>
              <div class="detail-chip"><span class="detail-chip-label">Next</span><span class="detail-chip-value">${card.state !== 'new' ? new Date(card.due).toLocaleDateString() : '—'}</span></div>
            </div>
            <div class="card-detail-actions">
              <button class="btn-suspend suspend-card-btn" data-id="${card.id}" data-action="${suspendBtnAction}" data-testid="suspend-card-btn">${suspendBtnLabel}</button>
            </div>
            ${timelineHtml}
          </div>
        `;
      }

      const cardTags = Array.isArray(card.tags) ? card.tags : [];
      const tagPillsHtml = cardTags.length > 0
        ? `<div class="card-row-tags" data-testid="card-row-tags">${cardTags.map(t => `<span class="tag-pill ${tagColorClass(t)}" data-testid="tag-pill">${escapeHtml(t)}</span>`).join('')}</div>`
        : '';

      row.innerHTML = `
        <div class="card-row-header" data-testid="card-row-header">
          <span class="card-chevron">${chevron}</span>
          <div class="card-row-content">
            <strong>${escapeHtml(card.front)}</strong>
            <span class="badge ${stateClass}">${stateLabel}</span>${leechBadge}
            ${tagPillsHtml}
          </div>
          <div class="card-row-meta">
            ${card.state !== 'new' ? `${formatInterval(card.interval)}` : 'New'}
          </div>
          <button class="btn-icon edit-card-btn" data-id="${card.id}" data-testid="edit-card" aria-label="Edit card">✎</button>
          <button class="btn-icon delete-card-btn" data-id="${card.id}" data-testid="delete-card" aria-label="Delete card">✕</button>
        </div>
        ${detailHtml}
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

    // Heatmap
    renderHeatmap(history);

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

    // Retention over time
    renderRetentionChart(history);

    // Forecast (next 14 days)
    renderForecast();

    // A/B experiment
    renderExperiment();
  }

  function renderExperiment() {
    const exp = Storage.getExperimentStats();
    const f = exp.fsrs5;
    const b = exp.betterfsrs;

    $('#exp-fsrs5-cards').textContent = f.cards;
    $('#exp-better-cards').textContent = b.cards;
    $('#exp-fsrs5-reviews').textContent = f.reviews;
    $('#exp-better-reviews').textContent = b.reviews;

    $('#exp-fsrs5-retention').textContent = f.reviews > 0
      ? `${(f.retention * 100).toFixed(1)}%` : '—';
    $('#exp-better-retention').textContent = b.reviews > 0
      ? `${(b.retention * 100).toFixed(1)}%` : '—';

    $('#exp-fsrs5-predr').textContent = f.reviews > 0 && f.meanPredR > 0
      ? `${(f.meanPredR * 100).toFixed(1)}%` : '—';
    $('#exp-better-predr').textContent = b.reviews > 0 && b.meanPredR > 0
      ? `${(b.meanPredR * 100).toFixed(1)}%` : '—';

    $('#exp-fsrs5-interval').textContent = f.reviews > 0
      ? formatInterval(Math.round(f.meanInterval)) : '—';
    $('#exp-better-interval').textContent = b.reviews > 0
      ? formatInterval(Math.round(b.meanInterval)) : '—';

    const summaryEl = $('#experiment-summary');
    const totalReviews = f.reviews + b.reviews;
    if (totalReviews === 0) {
      summaryEl.textContent = 'No experiment data yet. Create and review cards to start the A/B test.';
    } else {
      summaryEl.textContent = `${f.cards + b.cards} cards · ${totalReviews} reviews · 50/50 random assignment`;
    }
  }

  function renderHeatmap(history) {
    const gridEl = $('#heatmap-grid');
    const monthsEl = $('#heatmap-months');
    const summaryEl = $('#heatmap-summary');
    if (!gridEl || !monthsEl || !summaryEl) return;

    const TOTAL_DAYS = 91; // ~13 weeks
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Count reviews per day
    const dayCounts = {};
    history.forEach(h => {
      const d = new Date(h.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dayCounts[key] = (dayCounts[key] || 0) + 1;
    });

    // Build array of days, starting from (TOTAL_DAYS-1) days ago
    // Align to start on a Sunday for clean columns
    const startDate = new Date(todayStart);
    startDate.setDate(startDate.getDate() - (TOTAL_DAYS - 1));
    // Adjust start to previous Sunday
    const startDow = startDate.getDay(); // 0=Sun
    startDate.setDate(startDate.getDate() - startDow);

    const endDate = new Date(todayStart);
    const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Build grid: columns = weeks, rows = days of week (Sun-Sat)
    // We'll render as a flat grid with CSS grid doing 7 rows
    const cells = [];
    let activeDays = 0;
    let totalReviews = 0;

    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const count = dayCounts[key] || 0;
      const isFuture = date > todayStart;

      let level = 0;
      if (!isFuture && count > 0) {
        if (count <= 3) level = 1;
        else if (count <= 8) level = 2;
        else if (count <= 15) level = 3;
        else level = 4;
        activeDays++;
        totalReviews += count;
      }

      cells.push({ date, key, count, level, isFuture });
    }

    // Render grid cells
    gridEl.innerHTML = '';
    cells.forEach(cell => {
      const el = document.createElement('span');
      el.className = 'heatmap-cell';
      el.setAttribute('data-level', cell.isFuture ? 'future' : String(cell.level));
      el.setAttribute('data-testid', 'heatmap-cell');
      el.setAttribute('data-date', cell.key);
      if (!cell.isFuture) {
        el.title = `${cell.key}: ${cell.count} review${cell.count !== 1 ? 's' : ''}`;
      }
      gridEl.appendChild(el);
    });

    // Render month labels
    monthsEl.innerHTML = '';
    // Walk through weeks and place a label when the month changes
    const numWeeks = Math.ceil(totalDays / 7);
    let lastMonth = -1;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let w = 0; w < numWeeks; w++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + w * 7);
      const m = weekStart.getMonth();
      const span = document.createElement('span');
      span.className = 'heatmap-month-label';
      if (m !== lastMonth) {
        span.textContent = monthNames[m];
        lastMonth = m;
      }
      monthsEl.appendChild(span);
    }

    // Summary
    if (totalReviews === 0) {
      summaryEl.textContent = 'No reviews in the last 90 days.';
    } else {
      summaryEl.textContent = `${totalReviews} review${totalReviews !== 1 ? 's' : ''} across ${activeDays} day${activeDays !== 1 ? 's' : ''} in the last 90 days`;
    }
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

  // --- Retention over time ---

  function renderRetentionChart(history) {
    const canvas = $('#retention-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = 180;
    ctx.clearRect(0, 0, w, h);

    const summaryEl = $('#retention-summary');

    if (history.length === 0) {
      if (summaryEl) summaryEl.textContent = 'No review data yet. Complete some reviews to see your retention trend.';
      return;
    }

    // Group reviews into weekly buckets for the past 12 weeks
    const WEEKS = 12;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Each bucket: { recalled: 0, total: 0 }
    const buckets = [];
    for (let i = 0; i < WEEKS; i++) buckets.push({ recalled: 0, total: 0 });

    history.forEach(r => {
      const ts = new Date(r.timestamp);
      const daysAgo = Math.floor((todayStart - new Date(ts.getFullYear(), ts.getMonth(), ts.getDate())) / (1000 * 60 * 60 * 24));
      const weekIdx = Math.floor(daysAgo / 7);
      if (weekIdx >= 0 && weekIdx < WEEKS) {
        const bucket = buckets[WEEKS - 1 - weekIdx]; // oldest first
        bucket.total++;
        if (r.rating >= 2) bucket.recalled++;
      }
    });

    // Calculate retention rates (null for weeks with no data)
    const retentions = buckets.map(b => b.total > 0 ? b.recalled / b.total : null);

    // Find valid data points
    const validPoints = retentions.map((r, i) => r !== null ? { idx: i, val: r } : null).filter(Boolean);

    if (validPoints.length < 1) {
      if (summaryEl) summaryEl.textContent = 'Not enough data yet. Keep reviewing!';
      return;
    }

    // Chart dimensions
    const padLeft = 40;
    const padRight = 16;
    const padTop = 24;
    const padBottom = 28;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    // Y-axis: 50% to 100%
    const yMin = 0.5;
    const yMax = 1.0;

    function toX(i) { return padLeft + (i / (WEEKS - 1)) * chartW; }
    function toY(val) { return padTop + (1 - (val - yMin) / (yMax - yMin)) * chartH; }

    // Grid lines and Y labels
    ctx.strokeStyle = 'rgba(148,163,184,0.15)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';

    for (let pct = 50; pct <= 100; pct += 10) {
      const y = toY(pct / 100);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();
      ctx.fillText(`${pct}%`, padLeft - 4, y + 3);
    }

    // Desired retention reference line
    const settings = Storage.getSettings();
    const desiredR = settings.desiredRetention || 0.9;
    if (desiredR >= yMin && desiredR <= yMax) {
      const ry = toY(desiredR);
      ctx.strokeStyle = 'rgba(99,102,241,0.4)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padLeft, ry);
      ctx.lineTo(w - padRight, ry);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(99,102,241,0.7)';
      ctx.textAlign = 'left';
      ctx.fillText(`Target ${Math.round(desiredR * 100)}%`, padLeft + 4, ry - 4);
    }

    // X-axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    for (let i = 0; i < WEEKS; i++) {
      const weeksAgo = WEEKS - 1 - i;
      let label;
      if (weeksAgo === 0) label = 'This wk';
      else if (weeksAgo === 1) label = '1w ago';
      else label = `${weeksAgo}w`;

      // Only label every other week to avoid clutter
      if (WEEKS <= 8 || i % 2 === 0 || i === WEEKS - 1) {
        ctx.fillText(label, toX(i), h - 6);
      }
    }

    // Draw area fill under the line
    if (validPoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo(toX(validPoints[0].idx), toY(validPoints[0].val));
      for (let i = 1; i < validPoints.length; i++) {
        ctx.lineTo(toX(validPoints[i].idx), toY(validPoints[i].val));
      }
      ctx.lineTo(toX(validPoints[validPoints.length - 1].idx), toY(yMin));
      ctx.lineTo(toX(validPoints[0].idx), toY(yMin));
      ctx.closePath();
      ctx.fillStyle = 'rgba(99,102,241,0.08)';
      ctx.fill();
    }

    // Draw the line
    if (validPoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo(toX(validPoints[0].idx), toY(validPoints[0].val));
      for (let i = 1; i < validPoints.length; i++) {
        ctx.lineTo(toX(validPoints[i].idx), toY(validPoints[i].val));
      }
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Draw data points
    validPoints.forEach(p => {
      const x = toX(p.idx);
      const y = toY(p.val);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#6366f1';
      ctx.fill();
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Value label above point
      const bucket = buckets[p.idx];
      if (bucket.total >= 3) {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(p.val * 100)}%`, x, y - 10);
      }
    });

    // Summary text
    if (summaryEl) {
      const recentPoints = validPoints.filter(p => p.idx >= WEEKS - 4);
      const olderPoints = validPoints.filter(p => p.idx < WEEKS - 4);
      const recentAvg = recentPoints.length > 0
        ? recentPoints.reduce((s, p) => s + p.val, 0) / recentPoints.length : null;
      const olderAvg = olderPoints.length > 0
        ? olderPoints.reduce((s, p) => s + p.val, 0) / olderPoints.length : null;

      const totalRecalled = buckets.reduce((s, b) => s + b.recalled, 0);
      const totalReviews = buckets.reduce((s, b) => s + b.total, 0);
      const overallR = totalReviews > 0 ? Math.round((totalRecalled / totalReviews) * 100) : 0;

      let trend = '';
      if (recentAvg !== null && olderAvg !== null) {
        const diff = Math.round((recentAvg - olderAvg) * 100);
        if (diff > 2) trend = ` · Trending up (+${diff}pp)`;
        else if (diff < -2) trend = ` · Trending down (${diff}pp)`;
        else trend = ' · Stable';
      }

      summaryEl.textContent = `${overallR}% overall retention across ${totalReviews} reviews${trend}`;
    }
  }

  // --- Forecast ---

  function renderForecast() {
    const cards = Storage.getCards();
    const barsEl = $('#forecast-bars');
    const summaryEl = $('#forecast-summary');
    if (!barsEl || !summaryEl) return;

    const days = 14;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Count due cards per day for next 14 days
    const counts = new Array(days).fill(0);
    cards.forEach(card => {
      const due = new Date(card.due);
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      const diff = Math.floor((dueDay - todayStart) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff < days) {
        counts[diff]++;
      } else if (diff < 0) {
        // Overdue cards count as today
        counts[0]++;
      }
    });

    const maxCount = Math.max(...counts, 1);
    const totalUpcoming = counts.reduce((a, b) => a + b, 0);

    barsEl.innerHTML = '';
    const dayLabels = ['Today', 'Tom'];

    for (let i = 0; i < days; i++) {
      const date = new Date(todayStart);
      date.setDate(date.getDate() + i);

      let label;
      if (i === 0) label = 'Today';
      else if (i === 1) label = 'Tom';
      else label = `${date.getMonth() + 1}/${date.getDate()}`;

      const pct = (counts[i] / maxCount) * 100;
      const intensity = counts[i] === 0 ? 'empty' : counts[i] <= 3 ? 'low' : counts[i] <= 8 ? 'med' : 'high';

      const bar = document.createElement('div');
      bar.className = 'forecast-bar-col';
      bar.setAttribute('data-testid', 'forecast-bar');
      bar.innerHTML = `
        <div class="forecast-bar-count">${counts[i] || ''}</div>
        <div class="forecast-bar-track">
          <div class="forecast-bar-fill forecast-${intensity}" style="height:${Math.max(pct, counts[i] > 0 ? 4 : 0)}%"></div>
        </div>
        <div class="forecast-bar-label">${label}</div>
      `;
      barsEl.appendChild(bar);
    }

    if (totalUpcoming === 0) {
      summaryEl.textContent = 'No reviews scheduled in the next 14 days.';
    } else {
      const avgPerDay = (totalUpcoming / days).toFixed(1);
      summaryEl.textContent = `${totalUpcoming} review${totalUpcoming !== 1 ? 's' : ''} upcoming · ~${avgPerDay}/day avg`;
    }
  }

  // --- Edit modal ---

  function openEditModal(cardId) {
    const card = Storage.getCard(cardId);
    if (!card) return;
    $('#edit-card-id').value = card.id;
    $('#edit-front').value = card.front;
    $('#edit-back').value = card.back;
    if ($('#edit-tags')) {
      $('#edit-tags').value = Array.isArray(card.tags) ? card.tags.join(', ') : '';
    }
    $('#edit-modal').classList.remove('hidden');
    $('#edit-front').focus();
  }

  function closeEditModal() {
    $('#edit-modal').classList.add('hidden');
  }

  // --- Markdown rendering ---

  /**
   * Render text into a DOM element with markdown formatting.
   * If the text has no markdown syntax, falls back to plain text for speed.
   */
  function renderMarkdown(el, text) {
    if (Markdown.hasMarkdown(text)) {
      el.innerHTML = '<div class="md-content">' + Markdown.render(text) + '</div>';
    } else {
      el.textContent = text;
    }
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

  // --- Settings ---

  function applyDesiredRetention(r) {
    if (typeof FSRS !== 'undefined' && FSRS.setDesiredRetention) FSRS.setDesiredRetention(r);
    if (typeof BetterFSRS !== 'undefined' && BetterFSRS.setDesiredRetention) BetterFSRS.setDesiredRetention(r);
  }

  function renderSettings() {
    const settings = Storage.getSettings();
    const input = $('#settings-new-per-day');
    if (input) input.value = settings.newCardsPerDay;

    const leechInput = $('#settings-leech-threshold');
    if (leechInput) leechInput.value = settings.leechThreshold;

    // Desired retention slider
    const retSlider = $('#settings-desired-retention');
    const retValue = $('#retention-value');
    if (retSlider) {
      const pct = Math.round((settings.desiredRetention || 0.9) * 100);
      retSlider.value = pct;
      if (retValue) retValue.textContent = pct + '%';
    }

    const info = $('#settings-today-info');
    if (info) {
      const introduced = Storage.getNewCardsIntroducedToday();
      const limit = settings.newCardsPerDay;
      const stats = Storage.getStats();
      const suspendedInfo = stats.suspended > 0 ? ` · ${stats.suspended} suspended` : '';
      const retPct = Math.round((settings.desiredRetention || 0.9) * 100);
      info.textContent = `${introduced} of ${limit} new cards introduced today${suspendedInfo} · Target: ${retPct}% retention`;
    }
  }

  function showSettings() {
    show('settings');
    renderSettings();
    // Highlight gear button
    $('#settings-btn')?.classList.add('active');
    // Deselect all nav buttons since settings isn't in the nav
    $$('nav button').forEach(b => b.classList.remove('selected'));
  }

  // --- Theme ---

  function getTheme() {
    return localStorage.getItem('fsrs_theme') || 'dark';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fsrs_theme', theme);
    updateThemeIcon(theme);
  }

  function updateThemeIcon(theme) {
    const btn = $('#theme-toggle-btn');
    if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
  }

  function toggleTheme() {
    const current = getTheme();
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  // --- Init ---

  function init() {
    // Theme toggle
    updateThemeIcon(getTheme());
    $('#theme-toggle-btn')?.addEventListener('click', toggleTheme);

    // Nav
    $$('nav button').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        show(view);
        $('#settings-btn')?.classList.remove('active');
        if (view === 'dashboard') renderDashboard();
        if (view === 'cards') renderCardList();
        if (view === 'create') {}
        if (view === 'stats') renderStats();
      });
    });

    // Settings
    $('#settings-btn')?.addEventListener('click', showSettings);

    $('#settings-new-per-day')?.addEventListener('change', (e) => {
      const val = Math.max(0, Math.min(999, parseInt(e.target.value) || 0));
      e.target.value = val;
      const settings = Storage.getSettings();
      settings.newCardsPerDay = val;
      Storage.saveSettings(settings);
      renderSettings();
      showToast('Setting saved');
    });

    $('#settings-leech-threshold')?.addEventListener('change', (e) => {
      const val = Math.max(0, Math.min(99, parseInt(e.target.value) || 0));
      e.target.value = val;
      const settings = Storage.getSettings();
      settings.leechThreshold = val;
      Storage.saveSettings(settings);
      renderSettings();
      showToast(val > 0 ? `Leech threshold set to ${val} lapses` : 'Leech detection disabled');
    });

    // Desired retention slider
    const retSlider = $('#settings-desired-retention');
    if (retSlider) {
      retSlider.addEventListener('input', (e) => {
        const pct = parseInt(e.target.value);
        const retValue = $('#retention-value');
        if (retValue) retValue.textContent = pct + '%';
      });
      retSlider.addEventListener('change', (e) => {
        const pct = Math.max(70, Math.min(97, parseInt(e.target.value) || 90));
        e.target.value = pct;
        const r = pct / 100;
        const settings = Storage.getSettings();
        settings.desiredRetention = r;
        Storage.saveSettings(settings);
        applyDesiredRetention(r);
        renderSettings();
        showToast(`Target retention set to ${pct}%`);
      });
    }

    // Create mode tabs
    $$('.create-tab').forEach(tab => {
      tab.addEventListener('click', () => switchCreateMode(tab.dataset.mode));
    });

    // Create form (single)
    $('#create-form').addEventListener('submit', handleCreateCard);

    // Markdown preview
    $('#preview-toggle-btn')?.addEventListener('click', togglePreview);
    $('#card-front').addEventListener('input', updatePreview);
    $('#card-back').addEventListener('input', updatePreview);

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

    // Undo
    $('#undo-btn')?.addEventListener('click', undoLastRating);
    $('#summary-undo-btn')?.addEventListener('click', undoLastRating);

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
        return;
      }

      const suspendBtn = e.target.closest('.suspend-card-btn');
      if (suspendBtn) {
        const id = suspendBtn.dataset.id;
        if (suspendBtn.dataset.action === 'suspend') {
          Storage.suspendCard(id);
          showToast('Card suspended');
        } else {
          Storage.unsuspendCard(id);
          showToast('Card unsuspended');
        }
        renderCardList();
        renderDashboard();
        return;
      }

      // Expand/collapse card row
      const header = e.target.closest('.card-row-header');
      if (header) {
        const row = header.closest('.card-row');
        const cardId = row?.getAttribute('data-card-id');
        if (cardId) {
          expandedCardId = expandedCardId === cardId ? null : cardId;
          renderCardList();
        }
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
        card.tags = parseTags($('#edit-tags')?.value || '');
        Storage.saveCard(card);
        closeEditModal();
        renderCardList();
        showToast('Card updated');
      }
    });

    $('#edit-cancel-btn').addEventListener('click', closeEditModal);
    $('#edit-modal .modal-backdrop').addEventListener('click', closeEditModal);

    // Card sort
    $('#card-sort').addEventListener('change', (e) => {
      cardSortOrder = e.target.value;
      renderCardList();
    });

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

    // Tag filter (delegated — pills are re-rendered)
    $('#tag-filters')?.addEventListener('click', (e) => {
      const pill = e.target.closest('.tag-filter-pill');
      if (!pill) return;
      tagFilter = pill.dataset.tag || '';
      renderCardList();
    });

    // Dashboard tag filter for review (delegated — pills are re-rendered)
    $('#dashboard-tag-filter')?.addEventListener('click', (e) => {
      const pill = e.target.closest('.dashboard-tag-pill');
      if (!pill) return;
      reviewTagFilter = pill.dataset.tag || '';
      renderDashboard();
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

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undoLastRating();
        return;
      }

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

    // Apply saved desired retention to schedulers
    const savedSettings = Storage.getSettings();
    applyDesiredRetention(savedSettings.desiredRetention || 0.9);

    // Initial render
    renderDashboard();
    show('dashboard');
  }

  return { init, showToast };
})();

document.addEventListener('DOMContentLoaded', App.init);
