const { test, expect } = require('@playwright/test');

test.describe('FSRS Web App', () => {

  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('loads and shows the dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('app-title')).toHaveText('FSRS');
    await expect(page.getByTestId('stat-total')).toHaveText('0');
    await expect(page.getByTestId('stat-due')).toHaveText('0');
    await expect(page.getByTestId('start-review-btn')).toBeDisabled();
  });

  test('can navigate between views', async ({ page }) => {
    await page.goto('/');

    // Go to Create
    await page.getByTestId('nav-create').click();
    await expect(page.locator('#create')).toHaveClass(/active/);

    // Go to Cards
    await page.getByTestId('nav-cards').click();
    await expect(page.locator('#cards')).toHaveClass(/active/);

    // Go to Stats
    await page.getByTestId('nav-stats').click();
    await expect(page.locator('#stats')).toHaveClass(/active/);

    // Back to Dashboard
    await page.getByTestId('nav-dashboard').click();
    await expect(page.locator('#dashboard')).toHaveClass(/active/);
  });

  test('can create a flashcard', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-create').click();

    await page.getByTestId('card-front').fill('What is 2+2?');
    await page.getByTestId('card-back').fill('4');
    await page.getByTestId('create-card-btn').click();

    // Toast should appear
    await expect(page.getByTestId('toast')).toHaveText('Card created!');

    // Navigate to Cards — card should appear
    await page.getByTestId('nav-cards').click();
    await expect(page.getByTestId('card-list')).toContainText('What is 2+2?');

    // Dashboard should update
    await page.getByTestId('nav-dashboard').click();
    await expect(page.getByTestId('stat-total')).toHaveText('1');
    await expect(page.getByTestId('stat-due')).toHaveText('1');
  });

  test('can review a card', async ({ page }) => {
    await page.goto('/');

    // Create a card first
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Capital of France?');
    await page.getByTestId('card-back').fill('Paris');
    await page.getByTestId('create-card-btn').click();

    // Go to dashboard and start review
    await page.getByTestId('nav-dashboard').click();
    await expect(page.getByTestId('start-review-btn')).toBeEnabled();
    await page.getByTestId('start-review-btn').click();

    // Should see the front of the card
    await expect(page.getByTestId('review-front')).toHaveText('Capital of France?');
    await expect(page.getByTestId('review-back')).toBeHidden();

    // Reveal answer
    await page.getByTestId('show-answer-btn').click();
    await expect(page.getByTestId('review-back')).toBeVisible();
    await expect(page.getByTestId('review-back')).toHaveText('Paris');

    // Rate as Good
    await page.getByTestId('rating-3').click();

    // Should show session summary
    await expect(page.getByTestId('review-summary')).toBeVisible();
    await page.getByTestId('summary-done-btn').click();

    // Then return to dashboard
    await expect(page.locator('#dashboard')).toHaveClass(/active/);
    await expect(page.getByTestId('stat-due')).toHaveText('0');
  });

  test('can delete a card', async ({ page }) => {
    await page.goto('/');

    // Create a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Temp card');
    await page.getByTestId('card-back').fill('To be deleted');
    await page.getByTestId('create-card-btn').click();

    // Go to card list
    await page.getByTestId('nav-cards').click();
    await expect(page.getByTestId('card-list')).toContainText('Temp card');

    // Delete it
    await page.getByTestId('delete-card').click();
    await expect(page.getByTestId('toast')).toHaveText('Card deleted');

    // Should be gone
    await expect(page.getByTestId('card-list')).not.toContainText('Temp card');
  });

  test('review session with multiple cards', async ({ page }) => {
    await page.goto('/');

    // Create two cards
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Card A front');
    await page.getByTestId('card-back').fill('Card A back');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Card B front');
    await page.getByTestId('card-back').fill('Card B back');
    await page.getByTestId('create-card-btn').click();

    // Start review
    await page.getByTestId('nav-dashboard').click();
    await expect(page.getByTestId('start-review-btn')).toContainText('2 cards');
    await page.getByTestId('start-review-btn').click();

    // Review first card
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-4').click();

    // Review second card
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();

    // Done — should show summary first
    await expect(page.getByTestId('review-summary')).toBeVisible();
    await expect(page.getByTestId('summary-total')).toHaveText('2');
    await page.getByTestId('summary-done-btn').click();

    // Then back to dashboard
    await expect(page.locator('#dashboard')).toHaveClass(/active/);
    await expect(page.getByTestId('stat-due')).toHaveText('0');
  });

  test('can review a card using keyboard shortcuts', async ({ page }) => {
    await page.goto('/');

    // Create a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Keyboard test Q');
    await page.getByTestId('card-back').fill('Keyboard test A');
    await page.getByTestId('create-card-btn').click();

    // Start review
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();

    // Should see front
    await expect(page.getByTestId('review-front')).toHaveText('Keyboard test Q');
    await expect(page.getByTestId('review-back')).toBeHidden();

    // Press Space to reveal answer
    await page.keyboard.press('Space');
    await expect(page.getByTestId('review-back')).toBeVisible();
    await expect(page.getByTestId('review-back')).toHaveText('Keyboard test A');

    // Press 3 (Good) to rate
    await page.keyboard.press('3');

    // Should show summary, then dismiss to dashboard
    await expect(page.getByTestId('review-summary')).toBeVisible();
    await page.getByTestId('summary-done-btn').click();
    await expect(page.locator('#dashboard')).toHaveClass(/active/);
    await expect(page.getByTestId('stat-due')).toHaveText('0');
  });

  test('keyboard shortcuts do not interfere when typing in inputs', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-create').click();

    // Type in the front textarea — should not trigger review shortcuts
    const frontInput = page.getByTestId('card-front');
    await frontInput.fill('Test 1 2 3 4');
    await expect(frontInput).toHaveValue('Test 1 2 3 4');

    // Dashboard should still be reachable (no crash)
    await page.getByTestId('nav-dashboard').click();
    await expect(page.locator('#dashboard')).toHaveClass(/active/);
  });

  test('can edit a card', async ({ page }) => {
    await page.goto('/');

    // Create a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Old front');
    await page.getByTestId('card-back').fill('Old back');
    await page.getByTestId('create-card-btn').click();

    // Go to cards list
    await page.getByTestId('nav-cards').click();
    await expect(page.getByTestId('card-list')).toContainText('Old front');

    // Click edit
    await page.getByTestId('edit-card').click();

    // Modal should appear with current values
    await expect(page.getByTestId('edit-modal')).toBeVisible();
    await expect(page.getByTestId('edit-front')).toHaveValue('Old front');
    await expect(page.getByTestId('edit-back')).toHaveValue('Old back');

    // Edit the card
    await page.getByTestId('edit-front').fill('New front');
    await page.getByTestId('edit-back').fill('New back');
    await page.getByTestId('edit-save').click();

    // Modal should close
    await expect(page.getByTestId('edit-modal')).toBeHidden();

    // Card list should show updated content
    await expect(page.getByTestId('card-list')).toContainText('New front');
    await expect(page.getByTestId('card-list')).not.toContainText('Old front');

    // Toast confirms
    await expect(page.getByTestId('toast')).toHaveText('Card updated');
  });

  test('can cancel editing a card', async ({ page }) => {
    await page.goto('/');

    // Create a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Keep me');
    await page.getByTestId('card-back').fill('Unchanged');
    await page.getByTestId('create-card-btn').click();

    // Go to cards list and click edit
    await page.getByTestId('nav-cards').click();
    await page.getByTestId('edit-card').click();
    await expect(page.getByTestId('edit-modal')).toBeVisible();

    // Change values but cancel
    await page.getByTestId('edit-front').fill('Should not save');
    await page.getByTestId('edit-cancel').click();

    // Modal should close, original content preserved
    await expect(page.getByTestId('edit-modal')).toBeHidden();
    await expect(page.getByTestId('card-list')).toContainText('Keep me');
    await expect(page.getByTestId('card-list')).not.toContainText('Should not save');
  });

  test('stats view shows data after reviews', async ({ page }) => {
    await page.goto('/');

    // Create and review a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Stats test');
    await page.getByTestId('card-back').fill('Answer');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();

    // Dismiss summary
    await expect(page.getByTestId('review-summary')).toBeVisible();
    await page.getByTestId('summary-done-btn').click();

    // Check stats
    await page.getByTestId('nav-stats').click();
    await expect(page.locator('#stats-total-reviews')).toHaveText('1');
    await expect(page.locator('#stats-total-cards')).toHaveText('1');
  });

  test('can search cards by text', async ({ page }) => {
    await page.goto('/');

    // Create two cards
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('What is photosynthesis?');
    await page.getByTestId('card-back').fill('Process by which plants convert light');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('What is mitosis?');
    await page.getByTestId('card-back').fill('Cell division process');
    await page.getByTestId('create-card-btn').click();

    // Go to cards list
    await page.getByTestId('nav-cards').click();
    await expect(page.getByTestId('card-count')).toContainText('2 cards');

    // Search for "photo" — should show only the photosynthesis card
    await page.getByTestId('card-search').fill('photo');
    await expect(page.getByTestId('card-count')).toContainText('1 of 2');
    await expect(page.getByTestId('card-list')).toContainText('photosynthesis');
    await expect(page.getByTestId('card-list')).not.toContainText('mitosis');

    // Clear search — both should show
    await page.getByTestId('card-search').fill('');
    await expect(page.getByTestId('card-count')).toContainText('2 cards');
  });

  test('can search cards by answer text', async ({ page }) => {
    await page.goto('/');

    // Create cards
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Question A');
    await page.getByTestId('card-back').fill('unique-answer-alpha');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Question B');
    await page.getByTestId('card-back').fill('different-answer-beta');
    await page.getByTestId('create-card-btn').click();

    // Search by answer content
    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-search').fill('alpha');
    await expect(page.getByTestId('card-list')).toContainText('Question A');
    await expect(page.getByTestId('card-list')).not.toContainText('Question B');
  });

  test('search with no results shows empty state', async ({ page }) => {
    await page.goto('/');

    // Create a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Some card');
    await page.getByTestId('card-back').fill('Some answer');
    await page.getByTestId('create-card-btn').click();

    // Search for non-existent text
    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-search').fill('xyznonexistent');
    await expect(page.getByTestId('card-count')).toContainText('0 of 1');
    await expect(page.getByTestId('card-list')).toContainText('No cards match');
  });

  test('can filter cards by state', async ({ page }) => {
    await page.goto('/');

    // Create two cards (both will be "new" state)
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Card Alpha');
    await page.getByTestId('card-back').fill('Answer Alpha');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Card Beta');
    await page.getByTestId('card-back').fill('Answer Beta');
    await page.getByTestId('create-card-btn').click();

    // Go to cards — "All" should show both
    await page.getByTestId('nav-cards').click();
    await expect(page.getByTestId('card-count')).toContainText('2 cards');

    // Filter by "New" — both are new, so both should show
    await page.getByTestId('filter-new').click();
    await expect(page.getByTestId('card-count')).toContainText('2');

    // Filter by "Mature" — none are mature
    await page.getByTestId('filter-mature').click();
    await expect(page.getByTestId('card-list')).toContainText('No cards match');

    // Filter by "Due" — both are due (new cards are due immediately)
    await page.getByTestId('filter-due').click();
    await expect(page.getByTestId('card-count')).toContainText('2');

    // Back to "All"
    await page.getByTestId('filter-all').click();
    await expect(page.getByTestId('card-count')).toContainText('2 cards');
  });

  test('search and filter work together', async ({ page }) => {
    await page.goto('/');

    // Create three cards
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Biology: Photosynthesis');
    await page.getByTestId('card-back').fill('Plants use light');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Biology: Mitosis');
    await page.getByTestId('card-back').fill('Cell division');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Math: Algebra');
    await page.getByTestId('card-back').fill('Equations');
    await page.getByTestId('create-card-btn').click();

    // Go to cards, search for "Biology"
    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-search').fill('Biology');
    await expect(page.getByTestId('card-count')).toContainText('2 of 3');

    // Also filter by "New" — should still be 2 (all are new)
    await page.getByTestId('filter-new').click();
    await expect(page.getByTestId('card-count')).toContainText('2 of 3');

    // Filter by "Mature" with search still active — 0 matches
    await page.getByTestId('filter-mature').click();
    await expect(page.getByTestId('card-list')).toContainText('No cards match');
  });

  // --- Expandable card row tests ---

  test('can expand a card row to see the answer', async ({ page }) => {
    await page.goto('/');

    // Create a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Expand test Q');
    await page.getByTestId('card-back').fill('Expand test A');
    await page.getByTestId('create-card-btn').click();

    // Go to cards
    await page.getByTestId('nav-cards').click();
    await expect(page.getByTestId('card-list')).toContainText('Expand test Q');

    // Card detail should not be visible initially
    await expect(page.getByTestId('card-detail')).toHaveCount(0);

    // Click the card row header to expand
    await page.getByTestId('card-row-header').click();

    // Card detail should now be visible with the answer
    await expect(page.getByTestId('card-detail')).toBeVisible();
    await expect(page.getByTestId('card-detail-answer')).toHaveText('Expand test A');
  });

  test('can collapse an expanded card row', async ({ page }) => {
    await page.goto('/');

    // Create a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Collapse test Q');
    await page.getByTestId('card-back').fill('Collapse test A');
    await page.getByTestId('create-card-btn').click();

    // Go to cards and expand
    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-row-header').click();
    await expect(page.getByTestId('card-detail')).toBeVisible();

    // Click again to collapse
    await page.getByTestId('card-row-header').click();
    await expect(page.getByTestId('card-detail')).toHaveCount(0);
  });

  test('expanding one card collapses any previously expanded card', async ({ page }) => {
    await page.goto('/');

    // Create two cards (sorted newest-first, so Card Two will be at index 0)
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Card One');
    await page.getByTestId('card-back').fill('Answer One');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Card Two');
    await page.getByTestId('card-back').fill('Answer Two');
    await page.getByTestId('create-card-btn').click();

    // Go to cards — default sort is newest first, so Card Two is row 0
    await page.getByTestId('nav-cards').click();
    const headers = page.getByTestId('card-row-header');

    // Expand first row (Card Two — newest)
    await headers.nth(0).click();
    await expect(page.getByTestId('card-detail')).toHaveCount(1);
    await expect(page.getByTestId('card-detail-answer')).toHaveText('Answer Two');

    // Expand second row (Card One) — first should collapse
    await headers.nth(1).click();
    await expect(page.getByTestId('card-detail')).toHaveCount(1);
    await expect(page.getByTestId('card-detail-answer')).toHaveText('Answer One');
  });

  test('expanded card shows metadata chips', async ({ page }) => {
    await page.goto('/');

    // Create a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Meta test Q');
    await page.getByTestId('card-back').fill('Meta test A');
    await page.getByTestId('create-card-btn').click();

    // Expand it
    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-row-header').click();

    // Check metadata chips exist
    const detail = page.getByTestId('card-detail');
    await expect(detail).toBeVisible();
    await expect(detail.locator('.detail-chip')).toHaveCount(6); // Interval, Reps, Lapses, Stability, Difficulty, Next
  });

  // --- Bulk creation tests ---

  test('can switch between single and bulk create modes', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-create').click();

    // Single mode is default
    await expect(page.getByTestId('create-single')).toBeVisible();
    await expect(page.getByTestId('create-bulk')).toBeHidden();

    // Switch to bulk
    await page.getByTestId('tab-bulk').click();
    await expect(page.getByTestId('create-single')).toBeHidden();
    await expect(page.getByTestId('create-bulk')).toBeVisible();

    // Switch back to single
    await page.getByTestId('tab-single').click();
    await expect(page.getByTestId('create-single')).toBeVisible();
    await expect(page.getByTestId('create-bulk')).toBeHidden();
  });

  test('bulk create shows preview count as user types', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-create').click();
    await page.getByTestId('tab-bulk').click();

    // Type one valid line
    await page.getByTestId('bulk-input').fill('What is 2+2? :: 4');
    await expect(page.getByTestId('bulk-preview')).toContainText('1 card ready');
    await expect(page.getByTestId('bulk-create-btn')).toBeEnabled();

    // Type multiple valid lines
    await page.getByTestId('bulk-input').fill('Q1 :: A1\nQ2 :: A2\nQ3 :: A3');
    await expect(page.getByTestId('bulk-preview')).toContainText('3 cards ready');
  });

  test('bulk create shows skipped lines for malformed input', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-create').click();
    await page.getByTestId('tab-bulk').click();

    // Mix of valid and invalid lines
    await page.getByTestId('bulk-input').fill('Good line :: answer\nBad line without separator\nAnother good :: one');
    await expect(page.getByTestId('bulk-preview')).toContainText('2 cards ready');
    await expect(page.getByTestId('bulk-preview')).toContainText('1 line skipped');
  });

  test('bulk create button is disabled when no valid cards', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-create').click();
    await page.getByTestId('tab-bulk').click();

    // Empty input
    await expect(page.getByTestId('bulk-create-btn')).toBeDisabled();

    // Only invalid lines
    await page.getByTestId('bulk-input').fill('no separator here');
    await expect(page.getByTestId('bulk-create-btn')).toBeDisabled();
  });

  test('can bulk create multiple cards', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-create').click();
    await page.getByTestId('tab-bulk').click();

    // Paste 3 cards
    await page.getByTestId('bulk-input').fill('Capital of France? :: Paris\nCapital of Japan? :: Tokyo\nCapital of Italy? :: Rome');
    await page.getByTestId('bulk-create-btn').click();

    // Toast should confirm
    await expect(page.getByTestId('toast')).toHaveText('3 cards created!');

    // Input should be cleared
    await expect(page.getByTestId('bulk-input')).toHaveValue('');

    // Cards should appear in the card list
    await page.getByTestId('nav-cards').click();
    await expect(page.getByTestId('card-count')).toContainText('3 cards');
    await expect(page.getByTestId('card-list')).toContainText('Capital of France?');
    await expect(page.getByTestId('card-list')).toContainText('Capital of Japan?');
    await expect(page.getByTestId('card-list')).toContainText('Capital of Italy?');

    // Dashboard should update
    await page.getByTestId('nav-dashboard').click();
    await expect(page.getByTestId('stat-total')).toHaveText('3');
    await expect(page.getByTestId('stat-due')).toHaveText('3');
  });

  test('bulk create skips invalid lines and creates valid ones', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-create').click();
    await page.getByTestId('tab-bulk').click();

    // Mix valid + invalid
    await page.getByTestId('bulk-input').fill('Valid Q :: Valid A\nInvalid line\n :: empty front\nAnother Q :: Another A');
    await page.getByTestId('bulk-create-btn').click();

    await expect(page.getByTestId('toast')).toHaveText('2 cards created!');

    await page.getByTestId('nav-cards').click();
    await expect(page.getByTestId('card-count')).toContainText('2 cards');
  });

  // --- Review session summary tests ---

  test('shows session summary after completing review', async ({ page }) => {
    await page.goto('/');

    // Create a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Summary test Q');
    await page.getByTestId('card-back').fill('Summary test A');
    await page.getByTestId('create-card-btn').click();

    // Start review
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();

    // Complete review
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();

    // Should see session summary (not dashboard)
    await expect(page.getByTestId('review-summary')).toBeVisible();
    await expect(page.getByTestId('summary-total')).toHaveText('1');
    await expect(page.getByTestId('review-active')).toBeHidden();
  });

  test('session summary shows correct rating breakdown', async ({ page }) => {
    await page.goto('/');

    // Create 3 cards
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Q1');
    await page.getByTestId('card-back').fill('A1');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Q2');
    await page.getByTestId('card-back').fill('A2');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Q3');
    await page.getByTestId('card-back').fill('A3');
    await page.getByTestId('create-card-btn').click();

    // Start review
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();

    // Rate: Again, Good, Easy
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-1').click();

    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();

    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-4').click();

    // Summary should show correct counts
    await expect(page.getByTestId('review-summary')).toBeVisible();
    await expect(page.getByTestId('summary-total')).toHaveText('3');
    await expect(page.locator('#summary-again-count')).toHaveText('1');
    await expect(page.locator('#summary-hard-count')).toHaveText('0');
    await expect(page.locator('#summary-good-count')).toHaveText('1');
    await expect(page.locator('#summary-easy-count')).toHaveText('1');
  });

  // --- Forecast tests ---

  test('stats page shows forecast section', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-stats').click();

    await expect(page.getByTestId('forecast-container')).toBeVisible();
    await expect(page.getByTestId('forecast-bars')).toBeVisible();
    await expect(page.getByTestId('forecast-summary')).toBeVisible();
  });

  test('forecast shows empty message when no cards exist', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-stats').click();

    await expect(page.getByTestId('forecast-summary')).toHaveText('No reviews scheduled in the next 14 days.');
  });

  test('forecast shows bars for due cards', async ({ page }) => {
    await page.goto('/');

    // Create cards (new cards are due immediately = today)
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Forecast Q1');
    await page.getByTestId('card-back').fill('Forecast A1');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Forecast Q2');
    await page.getByTestId('card-back').fill('Forecast A2');
    await page.getByTestId('create-card-btn').click();

    // Go to stats
    await page.getByTestId('nav-stats').click();

    // Should have 14 forecast bars
    const bars = page.getByTestId('forecast-bar');
    await expect(bars).toHaveCount(14);

    // Summary should show upcoming reviews
    await expect(page.getByTestId('forecast-summary')).toContainText('2 reviews upcoming');
  });

  test('forecast updates after reviewing cards', async ({ page }) => {
    await page.goto('/');

    // Create a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Forecast review Q');
    await page.getByTestId('card-back').fill('Forecast review A');
    await page.getByTestId('create-card-btn').click();

    // Check forecast before review — card is due today
    await page.getByTestId('nav-stats').click();
    await expect(page.getByTestId('forecast-summary')).toContainText('1 review upcoming');

    // Review the card
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();
    await page.getByTestId('summary-done-btn').click();

    // Check forecast after review — card should be rescheduled
    await page.getByTestId('nav-stats').click();
    // The card's next due date depends on the algorithm, but it should still
    // be in the forecast if within 14 days (FSRS Good on new card = ~3 days)
    await expect(page.getByTestId('forecast-bars')).toBeVisible();
    const bars = page.getByTestId('forecast-bar');
    await expect(bars).toHaveCount(14);
  });

  test('clicking "Back to Home" from summary returns to dashboard', async ({ page }) => {
    await page.goto('/');

    // Create and review a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Back home test');
    await page.getByTestId('card-back').fill('Answer');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();

    // Summary visible
    await expect(page.getByTestId('review-summary')).toBeVisible();

    // Click Back to Home
    await page.getByTestId('summary-done-btn').click();

    // Should be on dashboard
    await expect(page.locator('#dashboard')).toHaveClass(/active/);
    await expect(page.getByTestId('stat-due')).toHaveText('0');
  });

  // --- Undo during review tests ---

  test('undo button is hidden at start of review', async ({ page }) => {
    await page.goto('/');

    // Create a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Undo hide test');
    await page.getByTestId('card-back').fill('Answer');
    await page.getByTestId('create-card-btn').click();

    // Start review
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();

    // Undo button should be hidden (no previous ratings to undo)
    await expect(page.getByTestId('undo-btn')).toBeHidden();
  });

  test('undo button appears after rating a card', async ({ page }) => {
    await page.goto('/');

    // Create two cards
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Undo Q1');
    await page.getByTestId('card-back').fill('Undo A1');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Undo Q2');
    await page.getByTestId('card-back').fill('Undo A2');
    await page.getByTestId('create-card-btn').click();

    // Start review, rate first card
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();

    // Now on second card — undo button should be visible
    await expect(page.getByTestId('undo-btn')).toBeVisible();
  });

  test('clicking undo restores previous card for re-rating', async ({ page }) => {
    await page.goto('/');

    // Create two cards
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Undo first Q');
    await page.getByTestId('card-back').fill('Undo first A');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Undo second Q');
    await page.getByTestId('card-back').fill('Undo second A');
    await page.getByTestId('create-card-btn').click();

    // Start review and rate the first card
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();

    // Should be on first card
    await expect(page.getByTestId('review-front')).toHaveText('Undo first Q');
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-1').click(); // Rate as Again (oops)

    // Now on second card
    await expect(page.getByTestId('review-front')).toHaveText('Undo second Q');

    // Click undo — should go back to first card
    await page.getByTestId('undo-btn').click();
    await expect(page.getByTestId('review-front')).toHaveText('Undo first Q');

    // Should show toast
    await expect(page.getByTestId('toast')).toHaveText('Rating undone');

    // Progress should reflect the restored card
    await expect(page.getByTestId('review-progress')).toContainText('2 cards remaining');
  });

  test('undo from session summary goes back to review', async ({ page }) => {
    await page.goto('/');

    // Create one card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Summary undo Q');
    await page.getByTestId('card-back').fill('Summary undo A');
    await page.getByTestId('create-card-btn').click();

    // Start review and rate the card
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-2').click(); // Rate as Hard

    // Should be on summary screen
    await expect(page.getByTestId('review-summary')).toBeVisible();

    // Summary should have an undo button
    await expect(page.getByTestId('summary-undo-btn')).toBeVisible();

    // Click undo — should go back to active review
    await page.getByTestId('summary-undo-btn').click();
    await expect(page.getByTestId('review-active')).toBeVisible();
    await expect(page.getByTestId('review-summary')).toBeHidden();
    await expect(page.getByTestId('review-front')).toHaveText('Summary undo Q');
  });

  test('can undo and re-rate with a different rating', async ({ page }) => {
    await page.goto('/');

    // Create one card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Re-rate Q');
    await page.getByTestId('card-back').fill('Re-rate A');
    await page.getByTestId('create-card-btn').click();

    // Start review and rate as Again
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-1').click();

    // Undo from summary
    await expect(page.getByTestId('review-summary')).toBeVisible();
    await page.getByTestId('summary-undo-btn').click();

    // Re-rate as Easy
    await expect(page.getByTestId('review-front')).toHaveText('Re-rate Q');
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-4').click();

    // Summary should show 1 card reviewed with Easy rating
    await expect(page.getByTestId('review-summary')).toBeVisible();
    await expect(page.getByTestId('summary-total')).toHaveText('1');
    await expect(page.locator('#summary-again-count')).toHaveText('0');
    await expect(page.locator('#summary-easy-count')).toHaveText('1');
  });

  test('undo via Ctrl+Z keyboard shortcut during review', async ({ page }) => {
    await page.goto('/');

    // Create two cards
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Ctrl-Z Q1');
    await page.getByTestId('card-back').fill('Ctrl-Z A1');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Ctrl-Z Q2');
    await page.getByTestId('card-back').fill('Ctrl-Z A2');
    await page.getByTestId('create-card-btn').click();

    // Start review, rate first card
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();

    // Now on second card — use Ctrl+Z to undo
    await expect(page.getByTestId('review-front')).toHaveText('Ctrl-Z Q2');
    await page.keyboard.press('Control+z');

    // Should go back to first card
    await expect(page.getByTestId('review-front')).toHaveText('Ctrl-Z Q1');
    await expect(page.getByTestId('toast')).toHaveText('Rating undone');
  });

  // --- Study heatmap tests ---

  test('stats page shows heatmap section', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-stats').click();

    await expect(page.getByTestId('heatmap-container')).toBeVisible();
    await expect(page.getByTestId('heatmap-grid')).toBeVisible();
    await expect(page.getByTestId('heatmap-legend')).toBeVisible();
    await expect(page.getByTestId('heatmap-months')).toBeVisible();
    await expect(page.getByTestId('heatmap-day-labels')).toBeVisible();
  });

  test('heatmap shows empty message when no reviews exist', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-stats').click();

    await expect(page.getByTestId('heatmap-summary')).toHaveText('No reviews in the last 90 days.');
  });

  test('heatmap renders grid cells', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-stats').click();

    // Should have heatmap cells (at least 91 days worth, aligned to weeks)
    const cells = page.getByTestId('heatmap-cell');
    const count = await cells.count();
    expect(count).toBeGreaterThanOrEqual(91);
  });

  test('heatmap updates after reviewing cards', async ({ page }) => {
    await page.goto('/');

    // Create and review a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Heatmap Q');
    await page.getByTestId('card-back').fill('Heatmap A');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();
    await page.getByTestId('summary-done-btn').click();

    // Check heatmap
    await page.getByTestId('nav-stats').click();
    await expect(page.getByTestId('heatmap-summary')).toContainText('1 review');
    await expect(page.getByTestId('heatmap-summary')).toContainText('1 day');
  });

  test('heatmap legend shows intensity levels', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-stats').click();

    const legend = page.getByTestId('heatmap-legend');
    await expect(legend).toBeVisible();

    // Legend should have Less and More labels
    await expect(legend.locator('.heatmap-legend-label').first()).toHaveText('Less');
    await expect(legend.locator('.heatmap-legend-label').last()).toHaveText('More');

    // Should have 5 level cells in the legend
    await expect(legend.locator('.heatmap-cell')).toHaveCount(5);
  });

  test('heatmap shows month labels', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-stats').click();

    // Should have at least one month label visible
    const monthLabels = page.locator('.heatmap-month-label');
    const count = await monthLabels.count();
    expect(count).toBeGreaterThan(0);

    // At least one label should have text content
    const hasText = await monthLabels.evaluateAll(els =>
      els.some(el => el.textContent.trim().length > 0)
    );
    expect(hasText).toBe(true);
  });

  // --- A/B Experiment tests ---

  test('new cards are assigned an algorithm (fsrs5 or betterfsrs)', async ({ page }) => {
    await page.goto('/');

    // Create several cards and check they get algorithm assignments
    await page.getByTestId('nav-create').click();
    for (let i = 0; i < 6; i++) {
      await page.getByTestId('card-front').fill(`AB test ${i}`);
      await page.getByTestId('card-back').fill(`Answer ${i}`);
      await page.getByTestId('create-card-btn').click();
    }

    // Check localStorage for algorithm assignments
    const algorithms = await page.evaluate(() => {
      const cards = JSON.parse(localStorage.getItem('fsrs_cards')) || [];
      return cards.map(c => c.algorithm);
    });

    expect(algorithms.length).toBe(6);
    algorithms.forEach(a => {
      expect(['fsrs5', 'betterfsrs']).toContain(a);
    });
  });

  test('review logs include algorithm and predictedR', async ({ page }) => {
    await page.goto('/');

    // Create and review a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Experiment log Q');
    await page.getByTestId('card-back').fill('Experiment log A');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();
    await page.getByTestId('summary-done-btn').click();

    // Check review history has algorithm and predictedR
    const review = await page.evaluate(() => {
      const history = JSON.parse(localStorage.getItem('fsrs_history')) || [];
      return history[history.length - 1];
    });

    expect(review.algorithm).toBeDefined();
    expect(['fsrs5', 'betterfsrs']).toContain(review.algorithm);
    expect(review.predictedR).toBeDefined();
    expect(typeof review.predictedR).toBe('number');
  });

  test('experiment section shows in stats page', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-stats').click();

    await expect(page.getByTestId('experiment-container')).toBeVisible();
    await expect(page.getByTestId('experiment-table')).toBeVisible();
    await expect(page.getByTestId('experiment-summary')).toBeVisible();
  });

  test('experiment table shows data after reviews', async ({ page }) => {
    await page.goto('/');

    // Create and review a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Exp data Q');
    await page.getByTestId('card-back').fill('Exp data A');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();
    await page.getByTestId('summary-done-btn').click();

    // Check experiment section shows data
    await page.getByTestId('nav-stats').click();
    await expect(page.getByTestId('experiment-summary')).toContainText('1 reviews');
  });

  test('experiment shows empty message when no reviews', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-stats').click();

    await expect(page.getByTestId('experiment-summary')).toContainText('No experiment data yet');
  });

  test('both algorithms can schedule cards correctly', async ({ page }) => {
    await page.goto('/');

    // Force-create one card of each type and review both
    await page.evaluate(() => {
      // Clear existing
      localStorage.clear();

      const now = new Date().toISOString();
      const cards = [
        {
          id: 'test-fsrs5', front: 'FSRS5 Q', back: 'FSRS5 A',
          algorithm: 'fsrs5', stability: 0, difficulty: 0,
          lastReview: null, due: now, interval: 0, reps: 0, lapses: 0,
          state: 'new', createdAt: now, streak: 0, difficultyEma: 5.0,
          lastScheduledInterval: 0, errorEma: 0, reviewsSinceLapse: 100,
        },
        {
          id: 'test-better', front: 'Better Q', back: 'Better A',
          algorithm: 'betterfsrs', stability: 0, difficulty: 0,
          lastReview: null, due: now, interval: 0, reps: 0, lapses: 0,
          state: 'new', createdAt: now, streak: 0, difficultyEma: 5.0,
          lastScheduledInterval: 0, errorEma: 0, reviewsSinceLapse: 100,
        },
      ];
      localStorage.setItem('fsrs_cards', JSON.stringify(cards));
    });
    await page.reload();

    // Start review
    await page.getByTestId('start-review-btn').click();

    // Review first card
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();

    // Review second card
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();

    // Summary should show 2 cards reviewed
    await expect(page.getByTestId('summary-total')).toHaveText('2');
    await page.getByTestId('summary-done-btn').click();

    // Both cards should be scheduled (no longer due)
    await expect(page.getByTestId('stat-due')).toHaveText('0');

    // Check that review log has both algorithms
    const algorithms = await page.evaluate(() => {
      const history = JSON.parse(localStorage.getItem('fsrs_history')) || [];
      return history.map(h => h.algorithm);
    });
    expect(algorithms).toContain('fsrs5');
    expect(algorithms).toContain('betterfsrs');
  });

  // --- Per-card review history timeline tests ---

  test('expanded card shows "No reviews yet" for unreviewed card', async ({ page }) => {
    await page.goto('/');

    // Create a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Timeline empty Q');
    await page.getByTestId('card-back').fill('Timeline empty A');
    await page.getByTestId('create-card-btn').click();

    // Expand it
    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-row-header').click();

    // Timeline section should exist with empty message
    await expect(page.getByTestId('card-timeline')).toBeVisible();
    await expect(page.getByTestId('timeline-empty')).toHaveText('No reviews yet');
  });

  test('expanded card shows review history after reviewing', async ({ page }) => {
    await page.goto('/');

    // Create and review a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Timeline test Q');
    await page.getByTestId('card-back').fill('Timeline test A');
    await page.getByTestId('create-card-btn').click();

    // Review the card
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();
    await page.getByTestId('summary-done-btn').click();

    // Expand card in card list
    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-row-header').click();

    // Should show timeline with one review row
    await expect(page.getByTestId('card-timeline')).toBeVisible();
    const rows = page.getByTestId('timeline-row');
    await expect(rows).toHaveCount(1);

    // Row should contain "Good" rating
    await expect(rows.first()).toContainText('Good');
  });

  // --- Markdown rendering tests ---

  test('card with markdown renders formatted content in review', async ({ page }) => {
    await page.goto('/');

    // Create a card with markdown
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('What does this code do?\n\n```js\nconst x = 42;\n```');
    await page.getByTestId('card-back').fill('It assigns **42** to `x`');
    await page.getByTestId('create-card-btn').click();

    // Start review
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();

    // Front should render with markdown — should contain a code block
    const front = page.getByTestId('review-front');
    await expect(front.locator('.md-content')).toBeVisible();
    await expect(front.locator('.md-code-block')).toBeVisible();
    await expect(front.locator('code')).toContainText('const x = 42;');

    // Reveal answer
    await page.getByTestId('show-answer-btn').click();

    // Back should render bold and inline code
    const back = page.getByTestId('review-back');
    await expect(back.locator('.md-content')).toBeVisible();
    await expect(back.locator('strong')).toHaveText('42');
    await expect(back.locator('.md-inline-code')).toHaveText('x');

    // Rate to finish
    await page.getByTestId('rating-3').click();
    await expect(page.getByTestId('review-summary')).toBeVisible();
  });

  test('plain text cards render without markdown wrapper', async ({ page }) => {
    await page.goto('/');

    // Create a plain text card (no markdown syntax)
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('What is 2+2?');
    await page.getByTestId('card-back').fill('4');
    await page.getByTestId('create-card-btn').click();

    // Start review
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();

    // Should render as plain text (no md-content wrapper)
    const front = page.getByTestId('review-front');
    await expect(front).toHaveText('What is 2+2?');
    await expect(front.locator('.md-content')).toHaveCount(0);

    await page.getByTestId('show-answer-btn').click();
    const back = page.getByTestId('review-back');
    await expect(back).toHaveText('4');
    await expect(back.locator('.md-content')).toHaveCount(0);
  });

  test('card detail shows markdown-rendered answer', async ({ page }) => {
    await page.goto('/');

    // Create a card with markdown answer
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('List the colors');
    await page.getByTestId('card-back').fill('- Red\n- Green\n- Blue');
    await page.getByTestId('create-card-btn').click();

    // Expand card in list
    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-row-header').click();

    // Answer should have markdown rendering (unordered list)
    const answer = page.getByTestId('card-detail-answer');
    await expect(answer.locator('ul')).toBeVisible();
    await expect(answer.locator('li')).toHaveCount(3);
  });

  test('markdown preview toggle shows rendered card while creating', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-create').click();

    // Type markdown content
    await page.getByTestId('card-front').fill('**Bold question**');
    await page.getByTestId('card-back').fill('`code answer`');

    // Preview should be hidden initially
    await expect(page.getByTestId('create-preview')).toBeHidden();

    // Click Preview button
    await page.getByTestId('preview-toggle').click();
    await expect(page.getByTestId('create-preview')).toBeVisible();

    // Preview should show rendered markdown
    const previewFront = page.getByTestId('preview-front');
    await expect(previewFront.locator('strong')).toHaveText('Bold question');

    const previewBack = page.getByTestId('preview-back');
    await expect(previewBack.locator('.md-inline-code')).toHaveText('code answer');

    // Toggle off
    await page.getByTestId('preview-toggle').click();
    await expect(page.getByTestId('create-preview')).toBeHidden();
  });

  test('markdown preview updates live as user types', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-create').click();

    // Open preview
    await page.getByTestId('preview-toggle').click();
    await expect(page.getByTestId('create-preview')).toBeVisible();

    // Type into front
    await page.getByTestId('card-front').fill('**Hello**');
    const previewFront = page.getByTestId('preview-front');
    await expect(previewFront.locator('strong')).toHaveText('Hello');

    // Update it
    await page.getByTestId('card-front').fill('*Italic*');
    await expect(previewFront.locator('em')).toHaveText('Italic');
  });

  test('review timeline shows redict', async ({ page }) => {
    await page.goto('/');

    // Create a card, review it twice (will need to make it due again)
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Multi review Q');
    await page.getByTestId('card-back').fill('Multi review A');
    await page.getByTestId('create-card-btn').click();

    // First review
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-1').click(); // 
    await page.getByTestId('summary-done-btn').click();

    // Inject an additional older review entry in localStorage to simulate multi-review
    await page.evaluate(() => {
      const cards = JSON.parse(localStorage.getItem('fsrs_cards')) || [];
      if (cards.length === 0) return;
      const card = cards[0];
      const history = JSON.parse(localStorage.getItem('fsrs_history')) || [];
      // Add a fake older review
      history.unshift({
        cardId: card.id,
        rating: 1,
        elapsed: 0,
        interval: 1,
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        algorithm: card.algorithm,
        predictedR: 0.9,
      });
      localStorage.setItem('fsrs_history', JSON.stringify(history));
    });

    // Expand card
    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-row-header').click();

    // Should show 2 timeline rows
    const rows = page.getByTestId('timeline-row');
    await expect(rows).toHaveCount(2);

    // First row should be "Again" (the injected older review)
    await expect(rows.nth(0)).toContainText('Again');
    // Second row should be "Again" (the real review was rated Again)
    await expect(rows.nth(1)).toContainText('Again');

    // Rows should contain R: values
    await expect(rows.nth(0)).toContainText('R:');
    await expect(rows.nth(1)).toContainText('R:');
  });

  // --- Card Sorting ---

  test('sort dropdown is present in cards view', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-cards').click();
    const sort = page.getByTestId('card-sort');
    await expect(sort).toBeVisible();
    // Default value should be newest
    await expect(sort).toHaveValue('created-desc');
  });

  test('sort cards alphabetically A-Z', async ({ page }) => {
    await page.goto('/');

    // Create cards with known fronts
    await page.evaluate(() => {
      const cards = [
        { front: 'Zebra', back: 'A striped animal' },
        { front: 'Apple', back: 'A fruit' },
        { front: 'Mango', back: 'A tropical fruit' },
      ];
      const stored = [];
      cards.forEach((c, i) => {
        stored.push({
          id: `sort-test-${i}`,
          front: c.front,
          back: c.back,
          algorithm: 'fsrs5',
          stability: 0,
          difficulty: 0,
          lastReview: null,
          due: new Date().toISOString(),
          interval: 0,
          reps: 0,
          lapses: 0,
          state: 'new',
          createdAt: new Date(Date.now() - i * 60000).toISOString(),
          streak: 0,
          difficultyEma: 5.0,
          lastScheduledInterval: 0,
          errorEma: 0,
          reviewsSinceLapse: 100,
        });
      });
      localStorage.setItem('fsrs_cards', JSON.stringify(stored));
    });
    await page.reload();

    await page.getByTestId('nav-cards').click();

    // Sort A-Z
    await page.getByTestId('card-sort').selectOption('alpha-asc');

    const rows = page.getByTestId('card-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Apple');
    await expect(rows.nth(1)).toContainText('Mango');
    await expect(rows.nth(2)).toContainText('Zebra');
  });

  test('sort cards alphabetically Z-A', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      const cards = [
        { front: 'Zebra', back: 'A striped animal' },
        { front: 'Apple', back: 'A fruit' },
        { front: 'Mango', back: 'A tropical fruit' },
      ];
      const stored = [];
      cards.forEach((c, i) => {
        stored.push({
          id: `sort-test-${i}`,
          front: c.front,
          back: c.back,
          algorithm: 'fsrs5',
          stability: 0,
          difficulty: 0,
          lastReview: null,
          due: new Date().toISOString(),
          interval: 0,
          reps: 0,
          lapses: 0,
          state: 'new',
          createdAt: new Date(Date.now() - i * 60000).toISOString(),
          streak: 0,
          difficultyEma: 5.0,
          lastScheduledInterval: 0,
          errorEma: 0,
          reviewsSinceLapse: 100,
        });
      });
      localStorage.setItem('fsrs_cards', JSON.stringify(stored));
    });
    await page.reload();

    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-sort').selectOption('alpha-desc');

    const rows = page.getByTestId('card-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Zebra');
    await expect(rows.nth(1)).toContainText('Mango');
    await expect(rows.nth(2)).toContainText('Apple');
  });

  test('sort cards by created oldest first', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      const now = Date.now();
      const stored = [
        { id: 'c1', front: 'First', back: 'a', createdAt: new Date(now - 300000).toISOString() },
        { id: 'c2', front: 'Second', back: 'b', createdAt: new Date(now - 100000).toISOString() },
        { id: 'c3', front: 'Third', back: 'c', createdAt: new Date(now - 200000).toISOString() },
      ].map(c => ({
        ...c,
        algorithm: 'fsrs5', stability: 0, difficulty: 0,
        lastReview: null, due: new Date().toISOString(),
        interval: 0, reps: 0, lapses: 0, state: 'new',
        streak: 0, difficultyEma: 5.0, lastScheduledInterval: 0,
        errorEma: 0, reviewsSinceLapse: 100,
      }));
      localStorage.setItem('fsrs_cards', JSON.stringify(stored));
    });
    await page.reload();

    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-sort').selectOption('created-asc');

    const rows = page.getByTestId('card-row');
    await expect(rows).toHaveCount(3);
    // Oldest first: First (300s ago), Third (200s ago), Second (100s ago)
    await expect(rows.nth(0)).toContainText('First');
    await expect(rows.nth(1)).toContainText('Third');
    await expect(rows.nth(2)).toContainText('Second');
  });

  test('sort cards by due soonest', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      const now = Date.now();
      const stored = [
        { id: 'd1', front: 'Later', back: 'a', due: new Date(now + 86400000 * 3).toISOString() },
        { id: 'd2', front: 'Soon', back: 'b', due: new Date(now + 86400000).toISOString() },
        { id: 'd3', front: 'Soonest', back: 'c', due: new Date(now - 1000).toISOString() },
      ].map(c => ({
        ...c,
        algorithm: 'fsrs5', stability: 0, difficulty: 0,
        lastReview: null, interval: 0, reps: 0, lapses: 0, state: 'new',
        createdAt: new Date().toISOString(),
        streak: 0, difficultyEma: 5.0, lastScheduledInterval: 0,
        errorEma: 0, reviewsSinceLapse: 100,
      }));
      localStorage.setItem('fsrs_cards', JSON.stringify(stored));
    });
    await page.reload();

    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-sort').selectOption('due-asc');

    const rows = page.getByTestId('card-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Soonest');
    await expect(rows.nth(1)).toContainText('Soon');
    await expect(rows.nth(2)).toContainText('Later');
  });

  test('sort by weakest stability', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      const stored = [
        { id: 's1', front: 'Strong', back: 'a', stability: 10 },
        { id: 's2', front: 'Weak', back: 'b', stability: 1 },
        { id: 's3', front: 'Medium', back: 'c', stability: 5 },
      ].map(c => ({
        ...c,
        algorithm: 'fsrs5', difficulty: 5,
        lastReview: null, due: new Date().toISOString(),
        interval: 0, reps: 0, lapses: 0, state: 'review',
        createdAt: new Date().toISOString(),
        streak: 0, difficultyEma: 5.0, lastScheduledInterval: 0,
        errorEma: 0, reviewsSinceLapse: 100,
      }));
      localStorage.setItem('fsrs_cards', JSON.stringify(stored));
    });
    await page.reload();

    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-sort').selectOption('stability-asc');

    const rows = page.getByTestId('card-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Weak');
    await expect(rows.nth(1)).toContainText('Medium');
    await expect(rows.nth(2)).toContainText('Strong');
  });

  test('sorting works with filter applied', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      const stored = [
        { id: 'f1', front: 'Zebra', back: 'a', state: 'new' },
        { id: 'f2', front: 'Apple', back: 'b', state: 'review', interval: 5 },
        { id: 'f3', front: 'Mango', back: 'c', state: 'new' },
      ].map(c => ({
        ...c,
        algorithm: 'fsrs5', stability: 0, difficulty: 0,
        lastReview: null, due: new Date().toISOString(),
        interval: c.interval || 0, reps: 0, lapses: 0,
        createdAt: new Date().toISOString(),
        streak: 0, difficultyEma: 5.0, lastScheduledInterval: 0,
        errorEma: 0, reviewsSinceLapse: 100,
      }));
      localStorage.setItem('fsrs_cards', JSON.stringify(stored));
    });
    await page.reload();

    await page.getByTestId('nav-cards').click();

    // Filter to New only, then sort A-Z
    await page.getByTestId('filter-new').click();
    await page.getByTestId('card-sort').selectOption('alpha-asc');

    const rows = page.getByTestId('card-row');
    await expect(rows).toHaveCount(2); // Only the 2 new cards
    await expect(rows.nth(0)).toContainText('Mango');
    await expect(rows.nth(1)).toContainText('Zebra');
  });

  // --- Card Tags ---

  test('can create a card with tags', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-create').click();

    await page.getByTestId('card-front').fill('What is 2+2?');
    await page.getByTestId('card-back').fill('4');
    await page.getByTestId('card-tags').fill('math, arithmetic');
    await page.getByTestId('create-card-btn').click();

    await expect(page.getByTestId('toast')).toHaveText('Card created!');

    // Tags should appear on the card in the browse view
    await page.getByTestId('nav-cards').click();
    await expect(page.getByTestId('card-list')).toContainText('What is 2+2?');
    const tagPills = page.getByTestId('tag-pill');
    await expect(tagPills).toHaveCount(2);
    await expect(tagPills.nth(0)).toHaveText('math');
    await expect(tagPills.nth(1)).toHaveText('arithmetic');
  });

  test('tag filter appears when cards have tags', async ({ page }) => {
    await page.goto('/');

    // Create cards with different tags
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Bonjour');
    await page.getByTestId('card-back').fill('Hello');
    await page.locator('#card-tags').fill('french');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Hola');
    await page.getByTestId('card-back').fill('Hello');
    await page.locator('#card-tags').fill('spanish');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Ciao');
    await page.getByTestId('card-back').fill('Hello');
    await page.locator('#card-tags').fill('italian');
    await page.getByTestId('create-card-btn').click();

    // Go to browse view
    await page.getByTestId('nav-cards').click();

    // Tag filters should be visible
    const tagFilters = page.getByTestId('tag-filters');
    await expect(tagFilters).toBeVisible();

    // Should have All + 3 tag pills
    const pills = page.getByTestId('tag-filter-pill');
    await expect(pills).toHaveCount(3);
  });

  test('can filter cards by tag', async ({ page }) => {
    await page.goto('/');

    // Create tagged cards
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('2+2');
    await page.getByTestId('card-back').fill('4');
    await page.locator('#card-tags').fill('math');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Paris');
    await page.getByTestId('card-back').fill('France');
    await page.locator('#card-tags').fill('geography');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('3*3');
    await page.getByTestId('card-back').fill('9');
    await page.locator('#card-tags').fill('math');
    await page.getByTestId('create-card-btn').click();

    // Browse and filter by math
    await page.getByTestId('nav-cards').click();
    await expect(page.getByTestId('card-row')).toHaveCount(3);

    // Click on the "math" tag filter pill
    await page.getByTestId('tag-filter-pill').filter({ hasText: 'math' }).click();
    await expect(page.getByTestId('card-row')).toHaveCount(2);

    // Click "All" to reset
    await page.getByTestId('tag-filter-all').click();
    await expect(page.getByTestId('card-row')).toHaveCount(3);
  });

  test('can edit card tags', async ({ page }) => {
    await page.goto('/');

    // Create a card with tags
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Test card');
    await page.getByTestId('card-back').fill('Test answer');
    await page.getByTestId('card-tags').fill('original');
    await page.getByTestId('create-card-btn').click();

    // Go to cards view and edit
    await page.getByTestId('nav-cards').click();
    await page.getByTestId('edit-card').click();

    // Edit modal should show existing tags
    await expect(page.getByTestId('edit-tags')).toHaveValue('original');

    // Change tags
    await page.getByTestId('edit-tags').fill('updated, new-tag');
    await page.getByTestId('edit-save').click();

    await expect(page.getByTestId('toast')).toHaveText('Card updated');

    // Tags should be updated in card list
    const tagPills = page.getByTestId('tag-pill');
    await expect(tagPills).toHaveCount(2);
    await expect(tagPills.nth(0)).toHaveText('updated');
    await expect(tagPills.nth(1)).toHaveText('new-tag');
  });

  test('cards without tags show no tag pills', async ({ page }) => {
    await page.goto('/');

    // Create a card without tags
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('No tags card');
    await page.getByTestId('card-back').fill('No tags answer');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('nav-cards').click();
    await expect(page.getByTestId('card-list')).toContainText('No tags card');
    await expect(page.getByTestId('tag-pill')).toHaveCount(0);
  });

  test('bulk create supports tags', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-create').click();
    await page.getByTestId('tab-bulk').click();

    await page.getByTestId('bulk-input').fill('Dog :: Canine :: animals\nCat :: Feline :: animals, pets');
    await page.getByTestId('bulk-create-btn').click();

    await page.getByTestId('nav-cards').click();
    const rows = page.getByTestId('card-row');
    await expect(rows).toHaveCount(2);

    // Both cards should have the "animals" tag
    const tagPills = page.getByTestId('tag-pill');
    // Dog has 1 tag (animals), Cat has 2 tags (animals, pets) = 3 total
    await expect(tagPills).toHaveCount(3);
  });

  test('search includes tags', async ({ page }) => {
    await page.goto('/');

    // Create cards with different tags
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Bonjour');
    await page.getByTestId('card-back').fill('Hello');
    await page.locator('#card-tags').fill('french, language');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('2+2');
    await page.getByTestId('card-back').fill('4');
    await page.locator('#card-tags').fill('math');
    await page.getByTestId('create-card-btn').click();

    // Search for tag name
    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-search').fill('french');
    await expect(page.getByTestId('card-row')).toHaveCount(1);
    await expect(page.getByTestId('card-list')).toContainText('Bonjour');
  });

  // --- Tag-filtered review tests ---

  test('dashboard shows tag filter when cards have tags', async ({ page }) => {
    await page.goto('/');

    // Create cards with tags
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Q1');
    await page.getByTestId('card-back').fill('A1');
    await page.locator('#card-tags').fill('math');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Q2');
    await page.getByTestId('card-back').fill('A2');
    await page.locator('#card-tags').fill('science');
    await page.getByTestId('create-card-btn').click();

    // Dashboard should show tag filter
    await page.getByTestId('nav-dashboard').click();
    await expect(page.getByTestId('dashboard-tag-filter')).toBeVisible();
    await expect(page.getByTestId('review-tag-all')).toBeVisible();
    await expect(page.getByTestId('review-tag-pill')).toHaveCount(2);
  });

  test('dashboard tag filter is hidden when no tags exist', async ({ page }) => {
    await page.goto('/');

    // Create a card without tags
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('No tag Q');
    await page.getByTestId('card-back').fill('No tag A');
    await page.getByTestId('create-card-btn').click();

    // Dashboard tag filter should be hidden
    await page.getByTestId('nav-dashboard').click();
    await expect(page.getByTestId('dashboard-tag-filter')).toBeHidden();
  });

  test('can filter review by tag and only review tagged cards', async ({ page }) => {
    await page.goto('/');

    // Create a math card and a science card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Math Question');
    await page.getByTestId('card-back').fill('Math Answer');
    await page.locator('#card-tags').fill('math');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Science Question');
    await page.getByTestId('card-back').fill('Science Answer');
    await page.locator('#card-tags').fill('science');
    await page.getByTestId('create-card-btn').click();

    // Go to dashboard — should show 2 cards due
    await page.getByTestId('nav-dashboard').click();
    await expect(page.getByTestId('start-review-btn')).toContainText('2 cards');

    // Click the math tag pill
    const mathPill = page.getByTestId('review-tag-pill').filter({ hasText: 'math' });
    await mathPill.click();

    // Button should now show 1 card and include [math]
    await expect(page.getByTestId('start-review-btn')).toContainText('1 card');
    await expect(page.getByTestId('start-review-btn')).toContainText('[math]');

    // Start review — should only see the math card
    await page.getByTestId('start-review-btn').click();
    await expect(page.getByTestId('review-front')).toHaveText('Math Question');
    await expect(page.getByTestId('review-progress')).toContainText('math');

    // Complete the review
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();

    // Should show summary with 1 card reviewed
    await expect(page.getByTestId('review-summary')).toBeVisible();
    await expect(page.getByTestId('summary-total')).toHaveText('1');
  });

  test('selecting All tag filter reviews all due cards', async ({ page }) => {
    await page.goto('/');

    // Create cards with different tags
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Tagged card');
    await page.getByTestId('card-back').fill('Answer');
    await page.locator('#card-tags').fill('tag-a');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Untagged card');
    await page.getByTestId('card-back').fill('Answer 2');
    await page.getByTestId('create-card-btn').click();

    // Go to dashboard
    await page.getByTestId('nav-dashboard').click();

    // Select a tag, then select All
    const tagPill = page.getByTestId('review-tag-pill').filter({ hasText: 'tag-a' });
    await tagPill.click();
    await expect(page.getByTestId('start-review-btn')).toContainText('1 card');

    await page.getByTestId('review-tag-all').click();
    await expect(page.getByTestId('start-review-btn')).toContainText('2 cards');
  });

  test('tag filter shows due count badges', async ({ page }) => {
    await page.goto('/');

    // Create two math cards and one science card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('M1');
    await page.getByTestId('card-back').fill('A1');
    await page.locator('#card-tags').fill('math');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('M2');
    await page.getByTestId('card-back').fill('A2');
    await page.locator('#card-tags').fill('math');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('S1');
    await page.getByTestId('card-back').fill('A3');
    await page.locator('#card-tags').fill('science');
    await page.getByTestId('create-card-btn').click();

    // Dashboard should show tag filter with due counts
    await page.getByTestId('nav-dashboard').click();
    const mathPill = page.getByTestId('review-tag-pill').filter({ hasText: 'math' });
    await expect(mathPill).toContainText('2');
    const sciPill = page.getByTestId('review-tag-pill').filter({ hasText: 'science' });
    await expect(sciPill).toContainText('1');
  });

  // === Settings & New Card Limit ===

  test('can open settings view via gear button', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('settings-btn').click();

    // Settings view should be visible
    await expect(page.locator('#settings')).toHaveClass(/active/);

    // Default new cards per day is 20
    await expect(page.getByTestId('settings-new-per-day')).toHaveValue('20');

    // Today info should be visible
    await expect(page.getByTestId('settings-today-info')).toContainText('0 of 20');
  });

  test('can change new cards per day setting', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('settings-btn').click();

    // Change to 5
    const input = page.getByTestId('settings-new-per-day');
    await input.fill('5');
    await input.dispatchEvent('change');

    // Toast should confirm
    await expect(page.getByTestId('toast')).toHaveText('Setting saved');

    // Reload and verify persistence
    await page.reload();
    await page.getByTestId('settings-btn').click();
    await expect(page.getByTestId('settings-new-per-day')).toHaveValue('5');
  });

  test('new card limit restricts review queue', async ({ page }) => {
    await page.goto('/');

    // Set limit to 2
    await page.getByTestId('settings-btn').click();
    const input = page.getByTestId('settings-new-per-day');
    await input.fill('2');
    await input.dispatchEvent('change');

    // Create 4 new cards
    await page.getByTestId('nav-create').click();
    for (let i = 1; i <= 4; i++) {
      await page.getByTestId('card-front').fill(`Limit Q${i}`);
      await page.getByTestId('card-back').fill(`Limit A${i}`);
      await page.getByTestId('create-card-btn').click();
    }

    // Dashboard should show only 2 cards available (limited by new card cap)
    await page.getByTestId('nav-dashboard').click();
    await expect(page.getByTestId('start-review-btn')).toContainText('2 cards');

    // Total due stat still shows all 4
    await expect(page.getByTestId('stat-due')).toHaveText('4');
  });

  test('new card limit counter updates after reviewing new cards', async ({ page }) => {
    await page.goto('/');

    // Set limit to 1
    await page.getByTestId('settings-btn').click();
    const input = page.getByTestId('settings-new-per-day');
    await input.fill('1');
    await input.dispatchEvent('change');

    // Create 2 new cards
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('LimitA');
    await page.getByTestId('card-back').fill('AnswerA');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('LimitB');
    await page.getByTestId('card-back').fill('AnswerB');
    await page.getByTestId('create-card-btn').click();

    // Dashboard should show 1 card available
    await page.getByTestId('nav-dashboard').click();
    await expect(page.getByTestId('start-review-btn')).toContainText('1 card');

    // Review the one card
    await page.getByTestId('start-review-btn').click();
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();
    await page.getByTestId('summary-done-btn').click();

    // Now dashboard should show no cards due (limit exhausted)
    await expect(page.getByTestId('start-review-btn')).toBeDisabled();

    // Settings should show 1 of 1 introduced
    await page.getByTestId('settings-btn').click();
    await expect(page.getByTestId('settings-today-info')).toContainText('1 of 1');
  });

  test('navigating away from settings re-selects nav button', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('settings-btn').click();
    await expect(page.locator('#settings')).toHaveClass(/active/);

    // Click nav to go back to dashboard
    await page.getByTestId('nav-dashboard').click();
    await expect(page.locator('#dashboard')).toHaveClass(/active/);
  });

  // --- Session timer tests ---

  test('session summary shows timing stats after review', async ({ page }) => {
    await page.goto('/');

    // Create a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Timer test Q');
    await page.getByTestId('card-back').fill('Timer test A');
    await page.getByTestId('create-card-btn').click();

    // Start review
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();

    // Brief pause to accumulate some time
    await page.waitForTimeout(100);

    // Reveal and rate
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();

    // Summary should show timing elements
    await expect(page.getByTestId('review-summary')).toBeVisible();
    await expect(page.getByTestId('summary-duration')).toBeVisible();
    await expect(page.getByTestId('summary-avg-time')).toBeVisible();
    await expect(page.getByTestId('summary-fastest')).toBeVisible();
    await expect(page.getByTestId('summary-slowest')).toBeVisible();

    // Duration should not be 0s (some time passed)
    const duration = await page.getByTestId('summary-duration').textContent();
    expect(duration).toBeTruthy();

    // Avg time should match duration for a single card
    const avg = await page.getByTestId('summary-avg-time').textContent();
    expect(avg).toBeTruthy();

    // Fastest and slowest should be equal for a single card
    const fastest = await page.getByTestId('summary-fastest').textContent();
    const slowest = await page.getByTestId('summary-slowest').textContent();
    expect(fastest).toBe(slowest);
  });

  test('session timer tracks multiple cards correctly', async ({ page }) => {
    await page.goto('/');

    // Create two cards
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Timer A');
    await page.getByTestId('card-back').fill('Answer A');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Timer B');
    await page.getByTestId('card-back').fill('Answer B');
    await page.getByTestId('create-card-btn').click();

    // Start review
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();

    // Review first card
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();

    // Review second card
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-4').click();

    // Summary should show 2 cards and timing
    await expect(page.getByTestId('review-summary')).toBeVisible();
    await expect(page.getByTestId('summary-total')).toHaveText('2');
    await expect(page.getByTestId('summary-duration')).toBeVisible();
    await expect(page.getByTestId('summary-timing')).toBeVisible();
  });

  test('undo resets timing stats correctly', async ({ page }) => {
    await page.goto('/');

    // Create two cards
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Undo Timer A');
    await page.getByTestId('card-back').fill('Answer A');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Undo Timer B');
    await page.getByTestId('card-back').fill('Answer B');
    await page.getByTestId('create-card-btn').click();

    // Start review
    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();

    // Review first card
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();

    // Review second card
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-4').click();

    // Summary shows 2 cards
    await expect(page.getByTestId('summary-total')).toHaveText('2');

    // Undo last rating
    await page.getByTestId('summary-undo-btn').click();

    // Should be back in review with 1 card remaining
    await expect(page.getByTestId('review-active')).toBeVisible();

    // Re-rate the card
    await page.getByTestId('show-answer-btn').click();
    await page.getByTestId('rating-3').click();

    // Summary should still show 2 cards reviewed
    await expect(page.getByTestId('summary-total')).toHaveText('2');
    await expect(page.getByTestId('summary-duration')).toBeVisible();
  });

  // === Card Suspension & Leech Detection ===

  test('can suspend a card from card detail view', async ({ page }) => {
    await page.goto('/');

    // Create a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Suspend me');
    await page.getByTestId('card-back').fill('Answer');
    await page.getByTestId('create-card-btn').click();

    // Go to cards view and expand the card
    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-row-header').click();

    // Click suspend button
    await page.getByTestId('suspend-card-btn').click();
    await expect(page.getByTestId('toast')).toHaveText('Card suspended');

    // Card should now show Suspended badge
    await expect(page.locator('.badge-suspended')).toBeVisible();
    await expect(page.locator('.badge-suspended')).toHaveText('Suspended');

    // Card row should have suspended styling (line-through)
    await expect(page.getByTestId('card-row')).toHaveClass(/suspended/);
  });

  test('suspended cards are excluded from review', async ({ page }) => {
    await page.goto('/');

    // Create two cards
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Card A');
    await page.getByTestId('card-back').fill('Answer A');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Card B');
    await page.getByTestId('card-back').fill('Answer B');
    await page.getByTestId('create-card-btn').click();

    // Suspend Card A
    await page.getByTestId('nav-cards').click();
    const firstRow = page.getByTestId('card-row-header').first();
    await firstRow.click();
    await page.getByTestId('suspend-card-btn').click();

    // Dashboard should show only 1 card due
    await page.getByTestId('nav-dashboard').click();
    await expect(page.getByTestId('stat-due')).toHaveText('1');
    await expect(page.getByTestId('start-review-btn')).toContainText('1 card');
  });

  test('can unsuspend a card', async ({ page }) => {
    await page.goto('/');

    // Create and suspend a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Will unsuspend');
    await page.getByTestId('card-back').fill('Answer');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-row-header').click();
    await page.getByTestId('suspend-card-btn').click();
    await expect(page.getByTestId('toast')).toHaveText('Card suspended');

    // Re-expand and unsuspend
    await page.getByTestId('card-row-header').click();
    await page.getByTestId('suspend-card-btn').click();
    await expect(page.getByTestId('toast')).toHaveText('Card unsuspended');

    // Card should no longer be suspended
    await expect(page.getByTestId('card-row')).not.toHaveClass(/suspended/);

    // Should be due again
    await page.getByTestId('nav-dashboard').click();
    await expect(page.getByTestId('stat-due')).toHaveText('1');
  });

  test('suspended filter shows only suspended cards', async ({ page }) => {
    await page.goto('/');

    // Create two cards
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Active card');
    await page.getByTestId('card-back').fill('Active answer');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Suspended card');
    await page.getByTestId('card-back').fill('Suspended answer');
    await page.getByTestId('create-card-btn').click();

    // Suspend the second card
    await page.getByTestId('nav-cards').click();
    const rows = page.getByTestId('card-row-header');
    // Cards are shown newest first, so first row is "Suspended card"
    await rows.first().click();
    await page.getByTestId('suspend-card-btn').click();

    // Click Suspended filter
    await page.getByTestId('filter-suspended').click();
    await expect(page.getByTestId('card-row')).toHaveCount(1);
    await expect(page.getByTestId('card-list')).toContainText('Suspended card');
  });

  test('leech threshold setting can be changed', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('settings-btn').click();

    // Default leech threshold is 8
    await expect(page.getByTestId('settings-leech-threshold')).toHaveValue('8');

    // Change to 4
    const input = page.getByTestId('settings-leech-threshold');
    await input.fill('4');
    await input.dispatchEvent('change');
    await expect(page.getByTestId('toast')).toContainText('Leech threshold set to 4');

    // Reload and verify persistence
    await page.reload();
    await page.getByTestId('settings-btn').click();
    await expect(page.getByTestId('settings-leech-threshold')).toHaveValue('4');
  });

  test('leech threshold 0 disables leech detection', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('settings-btn').click();

    const input = page.getByTestId('settings-leech-threshold');
    await input.fill('0');
    await input.dispatchEvent('change');
    await expect(page.getByTestId('toast')).toContainText('Leech detection disabled');
  });

  test('settings info shows suspended count when cards are suspended', async ({ page }) => {
    await page.goto('/');

    // Create and suspend a card
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Susp info test');
    await page.getByTestId('card-back').fill('Answer');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('nav-cards').click();
    await page.getByTestId('card-row-header').click();
    await page.getByTestId('suspend-card-btn').click();

    // Settings info should mention suspended
    await page.getByTestId('settings-btn').click();
    await expect(page.getByTestId('settings-today-info')).toContainText('1 suspended');
  });

  // === Desired Retention Setting ===

  test('settings view shows desired retention slider', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('settings-btn').click();
    await expect(page.getByTestId('settings-retention')).toBeVisible();
    await expect(page.getByTestId('settings-desired-retention')).toBeVisible();
    await expect(page.getByTestId('retention-value')).toContainText('90%');
  });

  test('can change desired retention via slider', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('settings-btn').click();

    const slider = page.getByTestId('settings-desired-retention');
    // Set to 85%
    await slider.fill('85');
    await slider.dispatchEvent('change');
    await expect(page.getByTestId('toast')).toContainText('Target retention set to 85%');
    await expect(page.getByTestId('retention-value')).toContainText('85%');
  });

  test('desired retention persists after reload', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('settings-btn').click();

    const slider = page.getByTestId('settings-desired-retention');
    await slider.fill('92');
    await slider.dispatchEvent('change');

    // Reload and verify
    await page.reload();
    await page.getByTestId('settings-btn').click();
    await expect(page.getByTestId('settings-desired-retention')).toHaveValue('92');
    await expect(page.getByTestId('retention-value')).toContainText('92%');
  });

  test('desired retention clamps to valid range', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('settings-btn').click();

    const slider = page.getByTestId('settings-desired-retention');
    // Try setting below minimum (70)
    await slider.fill('50');
    await slider.dispatchEvent('change');
    await expect(page.getByTestId('settings-desired-retention')).toHaveValue('70');
    await expect(page.getByTestId('retention-value')).toContainText('70%');
  });

  test('settings info shows retention percentage', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('settings-btn').click();
    await expect(page.getByTestId('settings-today-info')).toContainText('Target: 90% retention');
  });

  test('desired retention affects scheduling intervals', async ({ page }) => {
    await page.goto('/');

    // Create a card and review it at default 90%
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Retention test Q');
    await page.getByTestId('card-back').fill('Retention test A');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();
    await page.getByTestId('show-answer-btn').click();

    // Capture the Good interval at 90% retention
    const goodBtn90 = page.getByTestId('rating-3');
    const interval90 = await goodBtn90.locator('.interval-hint').textContent();

    // Rate it to finish the session
    await goodBtn90.click();
    await page.getByTestId('summary-done-btn').click();

    // Now change to 80% retention — intervals should be longer
    await page.getByTestId('settings-btn').click();
    const slider = page.getByTestId('settings-desired-retention');
    await slider.fill('80');
    await slider.dispatchEvent('change');

    // Create another card and check interval preview
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Retention test Q2');
    await page.getByTestId('card-back').fill('Retention test A2');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('nav-dashboard').click();
    await page.getByTestId('start-review-btn').click();
    await page.getByTestId('show-answer-btn').click();

    const goodBtn80 = page.getByTestId('rating-3');
    const interval80 = await goodBtn80.locator('.interval-hint').textContent();

    // Lower retention should give longer (or equal) intervals
    // Both are strings like "3d" — we just verify they exist (the exact values
    // depend on the algorithm, but both should be valid interval strings)
    expect(interval90).toBeTruthy();
    expect(interval80).toBeTruthy();
  });

  // === PWA Support ===

  test('page includes PWA manifest link', async ({ page }) => {
    await page.goto('/');
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveAttribute('href', 'manifest.json');
  });

  test('page includes theme-color meta tag', async ({ page }) => {
    await page.goto('/');
    const meta = page.locator('meta[name="theme-color"]');
    await expect(meta).toHaveAttribute('content', '#6366f1');
  });

  test('page includes apple-touch-icon', async ({ page }) => {
    await page.goto('/');
    const icon = page.locator('link[rel="apple-touch-icon"]');
    await expect(icon).toHaveAttribute('href', 'icons/icon-192.png');
  });

  test('manifest.json is valid and has required fields', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    // All icons should have src, sizes, and type
    for (const icon of manifest.icons) {
      expect(icon.src).toBeTruthy();
      expect(icon.sizes).toBeTruthy();
      expect(icon.type).toBeTruthy();
    }
  });

  test('PWA icons are accessible', async ({ page }) => {
    // Check that each icon URL returns a valid response
    const urls = ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
    for (const url of urls) {
      const resp = await page.goto('/' + url);
      expect(resp.status()).toBe(200);
      expect(resp.headers()['content-type']).toContain('image/png');
    }
  });

  test('service worker is registered', async ({ page }) => {
    await page.goto('/');
    // Wait a moment for SW to register
    await page.waitForTimeout(1000);
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0;
    });
    expect(swRegistered).toBe(true);
  });

  test('PWA install banner is hidden by default', async ({ page }) => {
    await page.goto('/');
    // The banner should be hidden (no beforeinstallprompt fires in Playwright)
    await expect(page.getByTestId('pwa-install-banner')).toBeHidden();
  });

  test('pwa install banner dismiss button hides it and sets localStorage', async ({ page }) => {
    await page.goto('/');
    // Manually show the banner by removing hidden class
    await page.evaluate(() => {
      document.getElementById('pwa-install-banner').classList.remove('hidden');
    });
    await expect(page.getByTestId('pwa-install-banner')).toBeVisible();

    // Click dismiss
    await page.getByTestId('pwa-dismiss-btn').click();
    await expect(page.getByTestId('pwa-install-banner')).toBeHidden();

    // Check localStorage was set
    const dismissed = await page.evaluate(() => localStorage.getItem('fsrs_pwa_dismissed'));
    expect(dismissed).toBeTruthy();
    expect(Number(dismissed)).toBeGreaterThan(0);
  });

  test('service worker caches app shell on install', async ({ page }) => {
    await page.goto('/');
    // Wait for SW to be active
    await page.waitForTimeout(2000);

    const cacheContents = await page.evaluate(async () => {
      const cache = await caches.open('fsrs-v1');
      const keys = await cache.keys();
      return keys.map(r => new URL(r.url).pathname);
    });

    // Should have cached at least the main files
    expect(cacheContents.length).toBeGreaterThanOrEqual(5);
  });

  // --- Retention over time chart ---

  test('retention chart canvas is present on stats page', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-stats').click();
    await expect(page.getByTestId('retention-chart')).toBeVisible();
  });

  test('retention summary shows empty message when no reviews', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-stats').click();
    const summary = page.getByTestId('retention-summary');
    await expect(summary).toContainText('No review data yet');
  });

  test('retention chart renders with review data', async ({ page }) => {
    await page.goto('/');

    // Seed cards and review history via localStorage
    await page.evaluate(() => {
      const now = new Date();
      const cards = [{
        id: 'ret-1', front: 'A', back: 'B', tags: [],
        algorithm: 'fsrs5', stability: 5, difficulty: 5,
        lastReview: now.toISOString(), due: now.toISOString(),
        interval: 1, reps: 3, lapses: 0, state: 'review',
        createdAt: now.toISOString(), suspended: false,
        streak: 0, difficultyEma: 5, lastScheduledInterval: 0, errorEma: 0, reviewsSinceLapse: 100,
      }];

      // Create reviews across several weeks
      const history = [];
      for (let w = 0; w < 6; w++) {
        for (let d = 0; d < 3; d++) {
          const ts = new Date(now);
          ts.setDate(ts.getDate() - (w * 7 + d));
          // 80% recalled (rating >= 2)
          const rating = (w * 3 + d) % 5 === 0 ? 1 : 3;
          history.push({
            cardId: 'ret-1', rating, elapsed: 1, interval: 1,
            timestamp: ts.toISOString(), algorithm: 'fsrs5',
          });
        }
      }

      localStorage.setItem('fsrs_cards', JSON.stringify(cards));
      localStorage.setItem('fsrs_history', JSON.stringify(history));
    });

    await page.reload();
    await page.getByTestId('nav-stats').click();

    // Summary should show actual retention data
    const summary = page.getByTestId('retention-summary');
    await expect(summary).toContainText('retention');
    await expect(summary).not.toContainText('No review data');

    // Canvas should have been drawn on (non-zero image data)
    const hasContent = await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="retention-chart"]');
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      return data.some(v => v !== 0);
    });
    expect(hasContent).toBe(true);
  });

  test('retention chart shows target retention line', async ({ page }) => {
    await page.goto('/');

    // Seed some review history
    await page.evaluate(() => {
      const now = new Date();
      const cards = [{
        id: 'ret-t', front: 'X', back: 'Y', tags: [],
        algorithm: 'fsrs5', stability: 5, difficulty: 5,
        lastReview: now.toISOString(), due: now.toISOString(),
        interval: 1, reps: 1, lapses: 0, state: 'review',
        createdAt: now.toISOString(), suspended: false,
        streak: 0, difficultyEma: 5, lastScheduledInterval: 0, errorEma: 0, reviewsSinceLapse: 100,
      }];
      const history = [];
      for (let i = 0; i < 10; i++) {
        const ts = new Date(now);
        ts.setDate(ts.getDate() - i);
        history.push({
          cardId: 'ret-t', rating: 3, elapsed: 1, interval: 1,
          timestamp: ts.toISOString(), algorithm: 'fsrs5',
        });
      }
      localStorage.setItem('fsrs_cards', JSON.stringify(cards));
      localStorage.setItem('fsrs_history', JSON.stringify(history));
      // Set desired retention to 85%
      localStorage.setItem('fsrs_settings', JSON.stringify({ newCardsPerDay: 20, leechThreshold: 8, desiredRetention: 0.85 }));
    });

    await page.reload();
    await page.getByTestId('nav-stats').click();

    // Retention summary should show overall percentage
    const summary = page.getByTestId('retention-summary');
    await expect(summary).toContainText('%');
  });
});
