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

    // Create two cards
    await page.getByTestId('nav-create').click();
    await page.getByTestId('card-front').fill('Card One');
    await page.getByTestId('card-back').fill('Answer One');
    await page.getByTestId('create-card-btn').click();

    await page.getByTestId('card-front').fill('Card Two');
    await page.getByTestId('card-back').fill('Answer Two');
    await page.getByTestId('create-card-btn').click();

    // Go to cards
    await page.getByTestId('nav-cards').click();
    const headers = page.getByTestId('card-row-header');

    // Expand first card
    await headers.nth(0).click();
    await expect(page.getByTestId('card-detail')).toHaveCount(1);
    await expect(page.getByTestId('card-detail-answer')).toHaveText('Answer One');

    // Expand second card — first should collapse
    await headers.nth(1).click();
    await expect(page.getByTestId('card-detail')).toHaveCount(1);
    await expect(page.getByTestId('card-detail-answer')).toHaveText('Answer Two');
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
});
