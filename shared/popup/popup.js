/**
 * Popup JavaScript Logic
 * Handles the main popup interface and user interactions
 */

class TurbodocPopup {
  constructor() {
    this.api = new TurbodocAPI();
    this.storage = new StorageManager(browserCompat);
    this.currentState = 'loading';
    this.currentTab = null;
    this.availableTags = [];
    this.selectedTags = new Set();
    this.tagsCache = null;
    this.tagsCacheExpiry = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    this.init();
  }

  /**
   * Initialize the popup
   */
  async init() {
    try {
      // Get current tab information
      await this.getCurrentTab();

      // Initialize authentication
      await this.initializeAuth();

      // Set up event listeners
      this.setupEventListeners();

      // Tags will be loaded when showing bookmark form
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.showError('Failed to initialize. Please try again.');
    }
  }

  /**
   * Get current active tab
   */
  async getCurrentTab() {
    try {
      const tabs = await browserCompat.tabs.query({
        active: true,
        currentWindow: true,
      });
      this.currentTab = tabs[0];
    } catch (error) {
      console.error('Failed to get current tab:', error);
    }
  }

  /**
   * Initialize authentication state
   */
  async initializeAuth() {
    try {
      // Initialize API (which will initialize Supabase)
      await this.api.init();

      if (this.api.isAuthenticated()) {
        // User is already authenticated via Supabase session
        this.showBookmarkForm();
      } else {
        // Show login form
        this.showLogin();
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      this.showLogin();
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', (e) => this.handleLogin(e));

    // Auth navigation buttons - redirect to web app
    const signUpLinkButton = document.getElementById('signUpLinkButton');
    signUpLinkButton.addEventListener('click', () => this.openSignUpPage());

    const forgotPasswordLinkButton = document.getElementById(
      'forgotPasswordLinkButton',
    );
    forgotPasswordLinkButton.addEventListener('click', () =>
      this.openForgotPasswordPage(),
    );

    // Bookmark form
    const bookmarkForm = document.getElementById('bookmarkForm');
    bookmarkForm.addEventListener('submit', (e) => this.handleSaveBookmark(e));

    // Note form
    const noteForm = document.getElementById('noteForm');
    noteForm.addEventListener('submit', (e) => this.handleSaveNote(e));

    // Sign out button in footer
    const signOutButton = document.getElementById('signOutButton');
    signOutButton.addEventListener('click', () => this.handleLogout());

    // Bookmark success state buttons
    const saveAnotherBookmarkButton = document.getElementById(
      'saveAnotherBookmarkButton',
    );
    saveAnotherBookmarkButton.addEventListener('click', () =>
      this.showBookmarkForm(),
    );

    // Note success state buttons
    const saveAnotherNoteButton = document.getElementById(
      'saveAnotherNoteButton',
    );
    saveAnotherNoteButton.addEventListener('click', () => this.showNoteForm());

    // Error state buttons
    const retryButton = document.getElementById('retryButton');
    retryButton.addEventListener('click', () => this.retryLastAction());

    const backButton = document.getElementById('backButton');
    backButton.addEventListener('click', () => this.showBookmarkForm());

    // Footer navigation buttons
    const addNoteButton = document.getElementById('addNoteButton');
    addNoteButton.addEventListener('click', () => this.showNoteForm());

    const addBookmarkButton = document.getElementById('addBookmarkButton');
    addBookmarkButton.addEventListener('click', () => this.showBookmarkForm());

    // Tags input for autocomplete
    const tagsInput = document.getElementById('tags');
    tagsInput.addEventListener('input', (e) => this.handleTagsInput(e));
    tagsInput.addEventListener('focus', () => this.showTagsSuggestions());
    tagsInput.addEventListener('blur', () => this.hideTagsSuggestions());
    tagsInput.addEventListener('change', () => this.parseTagsFromInput());
  }

  /**
   * Handle login form submission
   */
  async handleLogin(event) {
    event.preventDefault();

    const loginButton = document.getElementById('loginButton');
    const buttonText = loginButton.querySelector('.btn-text');
    const buttonSpinner = loginButton.querySelector('.btn-spinner');

    // Show loading state
    buttonText.textContent = 'Signing In...';
    buttonSpinner.classList.remove('hidden');
    loginButton.disabled = true;

    const formData = new FormData(event.target);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
      const result = await this.api.login(email, password);

      if (result.success) {
        // Load user tags
        // await this.loadUserTags(); TODO: Uncomment when endpoint exists

        // Show bookmark form
        this.showBookmarkForm();
      } else {
        this.showError(result.error || 'Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showError('Network error. Please check your connection.');
    } finally {
      // Reset button state
      buttonText.textContent = 'Sign In';
      buttonSpinner.classList.add('hidden');
      loginButton.disabled = false;
    }
  }

  /**
   * Open sign up page in web app
   */
  async openSignUpPage() {
    try {
      await browserCompat.tabs.create({
        url: 'https://turbodoc.ai/auth/sign-up',
      });
      window.close();
    } catch (error) {
      console.error('Failed to open sign up page:', error);
    }
  }

  /**
   * Open forgot password page in web app
   */
  async openForgotPasswordPage() {
    try {
      await browserCompat.tabs.create({
        url: 'https://turbodoc.ai/auth/forgot-password',
      });
      window.close();
    } catch (error) {
      console.error('Failed to open forgot password page:', error);
    }
  }

  /**
   * Handle bookmark save
   */
  async handleSaveBookmark(event) {
    event.preventDefault();

    const saveButton = document.getElementById('saveButton');
    const buttonText = saveButton.querySelector('.btn-text');
    const buttonSpinner = saveButton.querySelector('.btn-spinner');

    // Show loading state
    buttonText.textContent = 'Saving...';
    buttonSpinner.classList.remove('hidden');
    saveButton.disabled = true;

    const formData = new FormData(event.target);
    const bookmarkData = {
      title: formData.get('title'),
      url: formData.get('url'),
      tags: this.parseTags(formData.get('tags')),
      contentType: 'link',
    };

    try {
      const result = await this.api.createBookmark(bookmarkData);

      if (result.success) {
        this.showSuccess();

        // Auto-close popup if preference is enabled
        const preferences = await this.storage.getPreferences();
        if (preferences.data?.autoClosePopup) {
          setTimeout(() => {
            window.close();
          }, preferences.data?.autoCloseDelay || 1500);
        }
      } else {
        // Try to save to offline queue if network error
        if (
          result.error.includes('Network') ||
          result.error.includes('Server')
        ) {
          await this.storage.addToOfflineQueue(bookmarkData);
          this.showToast(
            'Bookmark saved offline. Will sync when connection is restored.',
            'info',
          );
          this.showSuccess();
        } else {
          this.showError(
            result.error || 'Failed to save bookmark. Please try again.',
          );
        }
      }
    } catch (error) {
      console.error('Save bookmark error:', error);
      this.showError('Network error. Please check your connection.');
    } finally {
      // Reset button state
      buttonText.textContent = 'Save Bookmark';
      buttonSpinner.classList.add('hidden');
      saveButton.disabled = false;
    }
  }

  /**
   * Handle note save
   */
  async handleSaveNote(event) {
    event.preventDefault();

    const saveButton = document.getElementById('saveNoteButton');
    const buttonText = saveButton.querySelector('.btn-text');
    const buttonSpinner = saveButton.querySelector('.btn-spinner');

    // Show loading state
    buttonText.textContent = 'Saving...';
    buttonSpinner.classList.remove('hidden');
    saveButton.disabled = true;

    const formData = new FormData(event.target);
    const noteData = {
      title: formData.get('noteTitle') || '',
      content: formData.get('noteContent'),
    };

    try {
      const result = await this.api.createNote(noteData);

      if (result.success) {
        this.showSuccess('note');

        // Auto-close popup if preference is enabled
        const preferences = await this.storage.getPreferences();
        if (preferences.data?.autoClosePopup) {
          setTimeout(() => {
            window.close();
          }, preferences.data?.autoCloseDelay || 1500);
        }
      } else {
        // Try to save to offline queue if network error
        if (
          result.error.includes('Network') ||
          result.error.includes('Server')
        ) {
          await this.storage.addToOfflineQueue(noteData);
          this.showToast(
            'Note saved offline. Will sync when connection is restored.',
            'info',
          );
          this.showSuccess('note');
        } else {
          this.showError(
            result.error || 'Failed to save note. Please try again.',
          );
        }
      }
    } catch (error) {
      console.error('Save note error:', error);
      this.showError('Network error. Please check your connection.');
    } finally {
      // Reset button state
      buttonText.textContent = 'Save Note';
      buttonSpinner.classList.add('hidden');
      saveButton.disabled = false;
    }
  }

  /**
   * Handle logout
   */
  async handleLogout() {
    try {
      await this.api.logout();
      this.showLogin();
    } catch (error) {
      console.error('Logout error:', error);
      // Show login even if logout fails
      this.showLogin();
    }
  }

  /**
   * Parse tags from input string
   */
  parseTags(tagsString) {
    if (!tagsString) {
      return '';
    }
    return tagsString
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .join('|');
  }

  /**
   * Load user tags for autocomplete with caching
   */
  async loadUserTags() {
    try {
      // Check cache first
      const now = Date.now();
      if (
        this.tagsCache &&
        this.tagsCacheExpiry &&
        now < this.tagsCacheExpiry
      ) {
        this.availableTags = this.tagsCache;
        this.displayTagChips();
        return;
      }

      const result = await this.api.getUserTags();
      if (result.success) {
        this.availableTags = result.data || [];
        // Cache the results
        this.tagsCache = this.availableTags;
        this.tagsCacheExpiry = now + this.CACHE_DURATION;
        this.displayTagChips();
      } else {
        console.warn('Failed to load user tags:', result.error);
        this.availableTags = [];
      }
    } catch (error) {
      console.error('Failed to load user tags:', error);
      this.availableTags = [];
    }
  }

  /**
   * Handle tags input for autocomplete
   */
  handleTagsInput(event) {
    const input = event.target.value;
    const currentTags = input
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    const lastTag = currentTags[currentTags.length - 1] || '';

    if (lastTag.length > 0) {
      const suggestions = this.availableTags.filter(
        (tag) =>
          tag.toLowerCase().includes(lastTag.toLowerCase()) &&
          !currentTags.includes(tag),
      );
      this.showTagsSuggestions(suggestions, lastTag);
    } else {
      this.hideTagsSuggestions();
    }
  }

  /**
   * Show tags suggestions
   */
  showTagsSuggestions(suggestions = [], _currentTag = '') {
    const container = document.getElementById('tagsSuggestions');

    if (!suggestions || suggestions.length === 0) {
      container.innerHTML = '';
      container.classList.remove('visible');
      return;
    }

    const suggestionsHTML = suggestions
      .slice(0, 5) // Limit to 5 suggestions
      .map(
        (tag) => `
        <div class="tag-suggestion" data-tag="${tag}">
          ${tag}
        </div>
      `,
      )
      .join('');

    container.innerHTML = suggestionsHTML;
    container.classList.add('visible');

    // Add click listeners to suggestions
    container.querySelectorAll('.tag-suggestion').forEach((el) => {
      el.addEventListener('click', () => {
        this.selectTag(el.dataset.tag);
      });
    });
  }

  /**
   * Hide tags suggestions
   */
  hideTagsSuggestions() {
    setTimeout(() => {
      const container = document.getElementById('tagsSuggestions');
      container.classList.remove('visible');
    }, 150);
  }

  /**
   * Display tag suggestion chips
   */
  displayTagChips() {
    const container = document.getElementById('tagSuggestionsChips');
    if (!container || !this.availableTags.length) {
      return;
    }

    const chipsHTML = this.availableTags
      .slice(0, 7)
      .map((tagData) => {
        const tagName = tagData.tag;
        const isSelected = this.selectedTags.has(tagName);
        return `
          <div class="tag-chip ${isSelected ? 'selected' : ''}" data-tag="${tagName}">
            <span class="tag-name">${tagName}</span>
          </div>
        `;
      })
      .join('');

    container.innerHTML = chipsHTML;

    // Add click listeners to chips
    container.querySelectorAll('.tag-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const tagName = chip.dataset.tag;
        this.toggleTagSelection(tagName);
      });
    });
  }

  /**
   * Toggle tag selection from chip
   */
  toggleTagSelection(tagName) {
    if (this.selectedTags.has(tagName)) {
      this.selectedTags.delete(tagName);
    } else {
      this.selectedTags.add(tagName);
    }

    this.updateTagsInput();
    this.displayTagChips(); // Refresh chips to show selection state
  }

  /**
   * Update the tags input field based on selected tags
   */
  updateTagsInput() {
    const tagsInput = document.getElementById('tags');
    const selectedTagsArray = Array.from(this.selectedTags);
    tagsInput.value = selectedTagsArray.join(', ');
  }

  /**
   * Parse tags from input and update selected tags set
   */
  parseTagsFromInput() {
    const tagsInput = document.getElementById('tags');
    const inputTags = tagsInput.value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    this.selectedTags.clear();
    inputTags.forEach((tag) => this.selectedTags.add(tag));
    this.displayTagChips(); // Refresh chips to show selection state
  }

  /**
   * Select a tag from suggestions
   */
  selectTag(tag) {
    const tagsInput = document.getElementById('tags');
    const currentValue = tagsInput.value;
    const currentTags = currentValue
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    // Replace the last partial tag with the selected one
    currentTags[currentTags.length - 1] = tag;

    tagsInput.value = currentTags.join(', ') + ', ';
    tagsInput.focus();
    this.hideTagsSuggestions();
  }

  /**
   * Show login state
   */
  showLogin() {
    this.hideAllStates();
    document.getElementById('loginState').classList.remove('hidden');
    document.getElementById('popupFooter').classList.add('hidden');
    this.currentState = 'login';

    // Clear form
    document.getElementById('loginForm').reset();

    // Focus email input
    setTimeout(() => {
      document.getElementById('email').focus();
    }, 100);
  }

  /**
   * Show bookmark form state
   */
  showBookmarkForm() {
    this.hideAllStates();
    document.getElementById('bookmarkState').classList.remove('hidden');
    document.getElementById('popupFooter').classList.remove('hidden');
    this.currentState = 'bookmark';

    // Hide add bookmark button, show add note button
    document.getElementById('addBookmarkButton').classList.add('hidden');
    document.getElementById('addNoteButton').classList.remove('hidden');

    // Pre-fill form with current tab data
    if (this.currentTab) {
      document.getElementById('title').value = this.currentTab.title || '';
      document.getElementById('url').value = this.currentTab.url || '';
    }

    // Clear selected tags
    this.selectedTags.clear();
    document.getElementById('tags').value = '';

    // Load and display tag chips
    this.loadUserTags();

    // Update user status
    const userStatus = document.getElementById('userStatus');
    if (this.api.getCurrentUser()) {
      userStatus.textContent = this.api.getCurrentUser().email;
    }

    // Focus title input
    setTimeout(() => {
      document.getElementById('title').focus();
      document.getElementById('title').select();
    }, 100);
  }

  /**
   * Show note form state
   */
  showNoteForm() {
    this.hideAllStates();
    document.getElementById('noteState').classList.remove('hidden');
    document.getElementById('popupFooter').classList.remove('hidden');
    this.currentState = 'note';

    // Hide add note button, show add bookmark button
    document.getElementById('addNoteButton').classList.add('hidden');
    document.getElementById('addBookmarkButton').classList.remove('hidden');

    // Pre-fill content with current URL
    const noteContent = document.getElementById('noteContent');
    if (this.currentTab) {
      noteContent.value = `Source: ${this.currentTab.url}\n\n`;
    }

    // Clear title
    document.getElementById('noteTitle').value = '';

    // Update user status
    const userStatus = document.getElementById('userStatus');
    if (this.api.getCurrentUser()) {
      userStatus.textContent = this.api.getCurrentUser().email;
    }

    // Focus content textarea
    setTimeout(() => {
      noteContent.focus();
      // Position cursor at end after URL
      noteContent.setSelectionRange(
        noteContent.value.length,
        noteContent.value.length,
      );
    }, 100);
  }

  /**
   * Show success state
   */
  showSuccess(type = 'bookmark') {
    this.hideAllStates();
    if (type === 'note') {
      document.getElementById('noteSuccessState').classList.remove('hidden');
    } else {
      document
        .getElementById('bookmarkSuccessState')
        .classList.remove('hidden');
    }
    document.getElementById('popupFooter').classList.remove('hidden');
    this.currentState = 'success';
  }

  /**
   * Show error state
   */
  showError(message) {
    this.hideAllStates();
    document.getElementById('errorState').classList.remove('hidden');
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('popupFooter').classList.add('hidden');
    this.currentState = 'error';
  }

  /**
   * Hide all state containers
   */
  hideAllStates() {
    document.querySelectorAll('.state-container').forEach((el) => {
      el.classList.add('hidden');
    });
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Show toast
    setTimeout(() => toast.classList.add('visible'), 10);

    // Hide and remove toast
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => container.removeChild(toast), 300);
    }, duration);
  }

  /**
   * Retry last action
   */
  retryLastAction() {
    if (this.currentState === 'error') {
      this.showBookmarkForm();
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new TurbodocPopup();
});
