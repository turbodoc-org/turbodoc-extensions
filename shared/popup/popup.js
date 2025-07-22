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
      
      // Load user tags for autocomplete
      if (this.api.isAuthenticated()) {
        await this.loadUserTags();
      }
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
      const tabs = await browserCompat.tabs.query({ active: true, currentWindow: true });
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

    const forgotPasswordLinkButton = document.getElementById('forgotPasswordLinkButton');
    forgotPasswordLinkButton.addEventListener('click', () => this.openForgotPasswordPage());

    // Bookmark form
    const bookmarkForm = document.getElementById('bookmarkForm');
    bookmarkForm.addEventListener('submit', (e) => this.handleSaveBookmark(e));

    // Sign out button in footer
    const signOutButton = document.getElementById('signOutButton');
    signOutButton.addEventListener('click', () => this.handleLogout());

    // Success state buttons
    const saveAnotherButton = document.getElementById('saveAnotherButton');
    saveAnotherButton.addEventListener('click', () => this.showBookmarkForm());

    const viewBookmarksButton = document.getElementById('viewBookmarksButton');
    viewBookmarksButton.addEventListener('click', () => this.openWebApp());

    // Error state buttons
    const retryButton = document.getElementById('retryButton');
    retryButton.addEventListener('click', () => this.retryLastAction());

    const backButton = document.getElementById('backButton');
    backButton.addEventListener('click', () => this.showBookmarkForm());

    // Footer buttons
    const openWebAppButton = document.getElementById('openWebAppButton');
    openWebAppButton.addEventListener('click', () => this.openWebApp());

    // Tags input for autocomplete
    const tagsInput = document.getElementById('tags');
    tagsInput.addEventListener('input', (e) => this.handleTagsInput(e));
    tagsInput.addEventListener('focus', () => this.showTagsSuggestions());
    tagsInput.addEventListener('blur', () => this.hideTagsSuggestions());
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
      await browserCompat.tabs.create({ url: 'https://turbodoc.ai/auth/sign-up' });
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
      await browserCompat.tabs.create({ url: 'https://turbodoc.ai/auth/forgot-password' });
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
      contentType: 'link'
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
        if (result.error.includes('Network') || result.error.includes('Server')) {
          await this.storage.addToOfflineQueue(bookmarkData);
          this.showToast('Bookmark saved offline. Will sync when connection is restored.', 'info');
          this.showSuccess();
        } else {
          this.showError(result.error || 'Failed to save bookmark. Please try again.');
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
    if (!tagsString) {return '';}
    return tagsString
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .join('|');
  }

  /**
   * Load user tags for autocomplete
   */
  loadUserTags() {
    try {
      // TODO: Add this when the endpoint exists
      // const result = await this.api.getUserTags();
      // if (result.success) {
      // this.availableTags = result.data || [];
      // }
      this.availableTags = [];
    } catch (error) {
      console.error('Failed to load user tags:', error);
    }
  }

  /**
   * Handle tags input for autocomplete
   */
  handleTagsInput(event) {
    const input = event.target.value;
    const currentTags = input
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    const lastTag = currentTags[currentTags.length - 1] || '';
    
    if (lastTag.length > 0) {
      const suggestions = this.availableTags.filter(tag => 
        tag.toLowerCase().includes(lastTag.toLowerCase()) &&
        !currentTags.includes(tag)
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
      .map(tag => `
        <div class="tag-suggestion" data-tag="${tag}">
          ${tag}
        </div>
      `).join('');

    container.innerHTML = suggestionsHTML;
    container.classList.add('visible');

    // Add click listeners to suggestions
    container.querySelectorAll('.tag-suggestion').forEach(el => {
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
   * Select a tag from suggestions
   */
  selectTag(tag) {
    const tagsInput = document.getElementById('tags');
    const currentValue = tagsInput.value;
    const currentTags = currentValue
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
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
    
    // Pre-fill form with current tab data
    if (this.currentTab) {
      document.getElementById('title').value = this.currentTab.title || '';
      document.getElementById('url').value = this.currentTab.url || '';
    }
    
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
   * Show success state
   */
  showSuccess() {
    this.hideAllStates();
    document.getElementById('successState').classList.remove('hidden');
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
    document.querySelectorAll('.state-container').forEach(el => {
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
   * Open web app in new tab
   */
  async openWebApp() {
    try {
      await browserCompat.tabs.create({ url: 'https://turbodoc.ai' });
      window.close();
    } catch (error) {
      console.error('Failed to open web app:', error);
    }
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