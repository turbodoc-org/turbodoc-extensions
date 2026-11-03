/**
 * Popup JavaScript Logic
 * Handles the main popup interface and user interactions
 */

const TAGS_CACHE_KEY = 'turbodoc_tags_cache';
const APP_URL = 'https://turbodoc.ai';

class TurbodocPopup {
  constructor() {
    this.api = new TurbodocAPI();
    this.storage = new StorageManager(browserCompat);
    this.currentState = 'loading';
    this.lastFormState = 'bookmark';
    this.currentTab = null;
    this.availableTags = []; // tag names, most used first
    this.tagsLoaded = false;
    this.selectedTags = []; // ordered, unique
    this.dropdownItems = [];
    this.dropdownIndex = -1;
    // Forms are only (re)filled on first show and after a successful save, so
    // switching tabs or retrying after an error never discards typed input.
    this.formDirty = { bookmark: false, note: false };

    this.$ = (id) => document.getElementById(id);

    this.init();
  }

  async init() {
    try {
      this.setupEventListeners();
      await this.getCurrentTab();
      await this.initializeAuth();
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.showError('Failed to initialize. Please try again.');
    }
  }

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

  async initializeAuth() {
    try {
      await this.api.init();
      if (this.api.isAuthenticated()) {
        this.showBookmarkForm();
      } else {
        this.showLogin();
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      this.showLogin();
    }
  }

  setupEventListeners() {
    this.$('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
    this.$('signUpLinkButton').addEventListener('click', () =>
      this.openTab(`${APP_URL}/auth/sign-up`),
    );
    this.$('forgotPasswordLinkButton').addEventListener('click', () =>
      this.openTab(`${APP_URL}/auth/forgot-password`),
    );

    this.$('bookmarkForm').addEventListener('submit', (e) =>
      this.handleSaveBookmark(e),
    );
    this.$('noteForm').addEventListener('submit', (e) =>
      this.handleSaveNote(e),
    );

    this.$('modeBookmark').addEventListener('click', () =>
      this.showBookmarkForm(),
    );
    this.$('modeNote').addEventListener('click', () => this.showNoteForm());

    this.$('signOutButton').addEventListener('click', () =>
      this.handleLogout(),
    );
    this.$('doneButton').addEventListener('click', () => window.close());
    this.$('retryButton').addEventListener('click', () =>
      this.retryLastAction(),
    );

    // Cmd/Ctrl+Enter saves from anywhere (handy in the note textarea)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        const form =
          this.currentState === 'note'
            ? this.$('noteForm')
            : this.currentState === 'bookmark'
              ? this.$('bookmarkForm')
              : null;
        if (form) {
          e.preventDefault();
          form.requestSubmit();
        }
      }
    });

    // Tag field
    const tagsInput = this.$('tags');
    this.$('tagField').addEventListener('mousedown', (e) => {
      if (e.target === e.currentTarget) {
        e.preventDefault();
        tagsInput.focus();
      }
    });
    tagsInput.addEventListener('input', () => this.updateDropdown());
    tagsInput.addEventListener('focus', () => this.updateDropdown());
    tagsInput.addEventListener('blur', () => {
      // Commit whatever was typed so it isn't silently lost
      this.commitTagInput();
      this.hideDropdown();
    });
    tagsInput.addEventListener('keydown', (e) => this.handleTagKeydown(e));
  }

  /* ---------------------------------------------------------------- Auth */

  async handleLogin(event) {
    event.preventDefault();
    const button = this.$('loginButton');
    this.setButtonLoading(button, true, 'Signing in…');

    const formData = new FormData(event.target);
    try {
      const result = await this.api.login(
        formData.get('email'),
        formData.get('password'),
      );
      if (result.success) {
        this.showBookmarkForm();
      } else {
        this.showError(result.error || 'Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showError('Network error. Please check your connection.');
    } finally {
      this.setButtonLoading(button, false, 'Sign in');
    }
  }

  async handleLogout() {
    try {
      await this.api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    this.availableTags = [];
    this.tagsLoaded = false;
    this.formDirty = { bookmark: false, note: false };
    await browserCompat.storage.local.remove(TAGS_CACHE_KEY).catch(() => {});
    this.showLogin();
  }

  async openTab(url) {
    try {
      await browserCompat.tabs.create({ url });
      window.close();
    } catch (error) {
      console.error('Failed to open tab:', error);
    }
  }

  /* ---------------------------------------------------------------- Save */

  async handleSaveBookmark(event) {
    event.preventDefault();
    this.commitTagInput();

    const button = this.$('saveButton');
    this.setButtonLoading(button, true, 'Saving…');

    const formData = new FormData(event.target);
    const bookmarkData = {
      title: (formData.get('title') || '').trim(),
      url: formData.get('url'),
      tags: this.selectedTags.join('|'),
      contentType: 'link',
    };

    try {
      const result = await this.api.createBookmark(bookmarkData);
      if (result.success) {
        this.bumpTagsInCache(this.selectedTags);
        this.showSuccess('bookmark');
        this.maybeAutoClose();
      } else if (this.isNetworkError(result.error)) {
        await this.storage.addToOfflineQueue(bookmarkData);
        this.showSuccess('bookmark', true);
      } else {
        this.showError(
          result.error || 'Failed to save bookmark. Please try again.',
        );
      }
    } catch (error) {
      console.error('Save bookmark error:', error);
      this.showError('Network error. Please check your connection.');
    } finally {
      this.setButtonLoading(button, false, 'Save bookmark');
    }
  }

  async handleSaveNote(event) {
    event.preventDefault();
    const button = this.$('saveNoteButton');
    this.setButtonLoading(button, true, 'Saving…');

    const formData = new FormData(event.target);
    const noteData = {
      title: formData.get('noteTitle') || '',
      content: formData.get('noteContent'),
    };

    try {
      const result = await this.api.createNote(noteData);
      if (result.success) {
        this.showSuccess('note');
        this.maybeAutoClose();
      } else if (this.isNetworkError(result.error)) {
        await this.storage.addToOfflineQueue(noteData);
        this.showSuccess('note', true);
      } else {
        this.showError(
          result.error || 'Failed to save note. Please try again.',
        );
      }
    } catch (error) {
      console.error('Save note error:', error);
      this.showError('Network error. Please check your connection.');
    } finally {
      this.setButtonLoading(button, false, 'Save note');
    }
  }

  isNetworkError(message = '') {
    return message.includes('Network') || message.includes('Server');
  }

  async maybeAutoClose() {
    const preferences = await this.storage.getPreferences();
    if (preferences.data?.autoClosePopup) {
      setTimeout(
        () => window.close(),
        preferences.data?.autoCloseDelay || 1500,
      );
    }
  }

  setButtonLoading(button, loading, label) {
    button.querySelector('.btn-text').textContent = label;
    button.querySelector('.btn-spinner').classList.toggle('hidden', !loading);
    button.disabled = loading;
  }

  /* ---------------------------------------------------------------- Tags */

  normalizeTags(raw) {
    const names = (raw || [])
      .map((t) => (typeof t === 'string' ? t : t?.tag))
      .filter((t) => typeof t === 'string' && t.trim())
      .map((t) => t.trim());
    return [...new Set(names)];
  }

  /**
   * Stale-while-revalidate: render cached tags immediately (the popup is
   * recreated on every open, so in-memory caching never helped), then refresh
   * from the API in the background.
   */
  async loadUserTags() {
    const userId = this.api.getCurrentUser()?.id;

    try {
      const cached = (await browserCompat.storage.local.get(TAGS_CACHE_KEY))[
        TAGS_CACHE_KEY
      ];
      if (cached && cached.userId === userId && Array.isArray(cached.tags)) {
        this.availableTags = cached.tags;
        this.tagsLoaded = true;
        this.renderSuggestedTags();
      }
    } catch (error) {
      console.warn('Failed to read tags cache:', error);
    }

    if (!this.tagsLoaded) {
      this.renderSuggestedTags(); // skeletons
    }

    try {
      const result = await this.api.getUserTags();
      if (result.success) {
        const fresh = this.normalizeTags(result.data);
        const changed =
          !this.tagsLoaded ||
          fresh.length !== this.availableTags.length ||
          fresh.some((t, i) => t !== this.availableTags[i]);
        this.availableTags = fresh;
        this.tagsLoaded = true;
        if (changed) {
          this.renderSuggestedTags();
        }
        browserCompat.storage.local
          .set({
            [TAGS_CACHE_KEY]: { userId, tags: fresh, fetchedAt: Date.now() },
          })
          .catch(() => {});
      } else if (!this.tagsLoaded) {
        this.tagsLoaded = true;
        this.renderSuggestedTags();
      }
    } catch (error) {
      console.error('Failed to load user tags:', error);
      if (!this.tagsLoaded) {
        this.tagsLoaded = true;
        this.renderSuggestedTags();
      }
    }
  }

  /** Move freshly used tags to the front of the cached list */
  bumpTagsInCache(tags) {
    if (!tags.length) return;
    const userId = this.api.getCurrentUser()?.id;
    const lower = new Set(tags.map((t) => t.toLowerCase()));
    const merged = [
      ...tags,
      ...this.availableTags.filter((t) => !lower.has(t.toLowerCase())),
    ];
    this.availableTags = merged;
    browserCompat.storage.local
      .set({
        [TAGS_CACHE_KEY]: { userId, tags: merged, fetchedAt: Date.now() },
      })
      .catch(() => {});
  }

  isSelected(tag) {
    const lower = tag.toLowerCase();
    return this.selectedTags.some((t) => t.toLowerCase() === lower);
  }

  addTag(raw) {
    const tag = raw.replace(/[,|]/g, ' ').trim();
    if (!tag || this.isSelected(tag)) return;
    // Reuse existing casing if the tag already exists
    const existing = this.availableTags.find(
      (t) => t.toLowerCase() === tag.toLowerCase(),
    );
    this.selectedTags.push(existing || tag);
    this.renderSelectedTags();
    this.renderSuggestedTags();
  }

  removeTag(tag) {
    this.selectedTags = this.selectedTags.filter((t) => t !== tag);
    this.renderSelectedTags();
    this.renderSuggestedTags();
  }

  commitTagInput() {
    const input = this.$('tags');
    input.value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => {
        this.addTag(t);
      });
    input.value = '';
  }

  handleTagKeydown(e) {
    const input = e.target;
    const open = this.$('tagsSuggestions').classList.contains('visible');

    if (e.key === 'ArrowDown' && open) {
      e.preventDefault();
      this.setDropdownIndex(this.dropdownIndex + 1);
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault();
      this.setDropdownIndex(this.dropdownIndex - 1);
    } else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      if (input.value.trim()) {
        e.preventDefault();
        const pick = open ? this.dropdownItems[this.dropdownIndex] : null;
        if (pick) {
          this.addTag(pick);
          input.value = '';
        } else {
          this.commitTagInput();
        }
        this.updateDropdown();
      }
      // Empty input: let Enter submit the form
    } else if (e.key === ',' || e.key === 'Tab') {
      if (input.value.trim()) {
        e.preventDefault();
        const pick =
          e.key === 'Tab' && open
            ? this.dropdownItems[this.dropdownIndex]
            : null;
        if (pick) {
          this.addTag(pick);
          input.value = '';
        } else {
          this.commitTagInput();
        }
        this.updateDropdown();
      }
    } else if (
      e.key === 'Backspace' &&
      !input.value &&
      this.selectedTags.length
    ) {
      this.removeTag(this.selectedTags[this.selectedTags.length - 1]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      this.hideDropdown();
    }
  }

  updateDropdown() {
    const input = this.$('tags');
    const query = input.value.trim().toLowerCase();
    if (!query) {
      this.hideDropdown();
      return;
    }

    const matches = this.availableTags
      .filter((t) => !this.isSelected(t) && t.toLowerCase().includes(query))
      .sort(
        (a, b) =>
          Number(!a.toLowerCase().startsWith(query)) -
          Number(!b.toLowerCase().startsWith(query)),
      )
      .slice(0, 6);

    const exact = this.availableTags.some((t) => t.toLowerCase() === query);
    this.dropdownItems = [...matches];
    const container = this.$('tagsSuggestions');
    container.replaceChildren();

    matches.forEach((tag) => {
      container.appendChild(this.createOption(tag, tag));
    });

    if (!exact && !this.isSelected(query)) {
      const raw = input.value.trim();
      const opt = this.createOption(raw, null);
      opt.classList.add('tag-option-new');
      opt.append('Create ');
      const strong = document.createElement('strong');
      strong.textContent = `"${raw}"`;
      opt.appendChild(strong);
      container.appendChild(opt);
      this.dropdownItems.push(raw);
    }

    if (!this.dropdownItems.length) {
      this.hideDropdown();
      return;
    }

    container.classList.add('visible');
    input.setAttribute('aria-expanded', 'true');
    this.setDropdownIndex(0);
  }

  createOption(value, label) {
    const opt = document.createElement('div');
    opt.className = 'tag-option';
    opt.setAttribute('role', 'option');
    if (label) opt.textContent = label;
    // mousedown (not click) so the input doesn't blur first
    opt.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.addTag(value);
      this.$('tags').value = '';
      this.hideDropdown();
    });
    return opt;
  }

  setDropdownIndex(index) {
    const options = this.$('tagsSuggestions').children;
    if (!options.length) return;
    this.dropdownIndex = (index + options.length) % options.length;
    Array.from(options).forEach((el, i) => {
      el.classList.toggle('active', i === this.dropdownIndex);
      el.setAttribute('aria-selected', String(i === this.dropdownIndex));
    });
    options[this.dropdownIndex].scrollIntoView({ block: 'nearest' });
  }

  hideDropdown() {
    const container = this.$('tagsSuggestions');
    container.classList.remove('visible');
    container.replaceChildren();
    this.dropdownItems = [];
    this.dropdownIndex = -1;
    this.$('tags').setAttribute('aria-expanded', 'false');
  }

  renderSelectedTags() {
    const container = this.$('selectedTags');
    container.replaceChildren(
      ...this.selectedTags.map((tag) => {
        const pill = document.createElement('span');
        pill.className = 'tag-pill';
        const name = document.createElement('span');
        name.textContent = tag;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Remove ${tag}`);
        remove.innerHTML =
          '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
        remove.addEventListener('click', () => {
          this.removeTag(tag);
          this.$('tags').focus();
        });
        pill.append(name, remove);
        return pill;
      }),
    );
    this.$('tags').placeholder = this.selectedTags.length ? '' : 'Add tags…';
  }

  /** Renders into a fixed-height row, so this never shifts the layout */
  renderSuggestedTags() {
    const container = this.$('tagSuggestionsChips');

    if (!this.tagsLoaded) {
      container.replaceChildren(
        ...[64, 48, 80, 56, 44].map((w) => {
          const s = document.createElement('span');
          s.className = 'skeleton-chip';
          s.style.width = `${w}px`;
          return s;
        }),
      );
      return;
    }

    const suggestions = this.availableTags
      .filter((t) => !this.isSelected(t))
      .slice(0, 12);

    if (!suggestions.length) {
      const hint = document.createElement('span');
      hint.className = 'suggested-hint';
      hint.textContent = this.availableTags.length
        ? 'All your top tags are added'
        : 'Type a tag and press Enter';
      container.replaceChildren(hint);
      return;
    }

    container.replaceChildren(
      ...suggestions.map((tag) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'suggest-chip';
        chip.textContent = tag;
        chip.title = `Add “${tag}”`;
        chip.addEventListener('click', () => this.addTag(tag));
        return chip;
      }),
    );
  }

  /* -------------------------------------------------------------- States */

  setMode(mode) {
    const isNote = mode === 'note';
    this.$('modeBookmark').classList.toggle('active', !isNote);
    this.$('modeNote').classList.toggle('active', isNote);
    this.$('modeBookmark').setAttribute('aria-selected', String(!isNote));
    this.$('modeNote').setAttribute('aria-selected', String(isNote));
    this.$('openAppLink').href = `${APP_URL}/${isNote ? 'notes' : 'bookmarks'}`;
  }

  setChrome({ signedIn }) {
    this.$('modeSwitch').classList.toggle('hidden', !signedIn);
    this.$('popupFooter').classList.toggle('hidden', !signedIn);
    const user = this.api.getCurrentUser();
    if (signedIn && user) {
      this.$('userStatus').textContent = user.email;
      this.$('userStatus').title = user.email;
    }
  }

  showState(id) {
    document.querySelectorAll('.state-container').forEach((el) => {
      el.classList.toggle('hidden', el.id !== id);
    });
  }

  showLogin() {
    this.showState('loginState');
    this.setChrome({ signedIn: false });
    this.currentState = 'login';
    this.$('loginForm').reset();
    setTimeout(() => this.$('email').focus(), 50);
  }

  showBookmarkForm() {
    this.showState('bookmarkState');
    this.setChrome({ signedIn: true });
    this.setMode('bookmark');
    this.currentState = 'bookmark';
    this.lastFormState = 'bookmark';

    if (!this.formDirty.bookmark) {
      this.formDirty.bookmark = true;
      const tab = this.currentTab;
      this.$('title').value = tab?.title || '';
      this.$('url').value = tab?.url || '';
      this.renderPageCard(tab);

      this.selectedTags = [];
      this.$('tags').value = '';
      this.renderSelectedTags();
      this.loadUserTags();
    }

    // Title is almost always right as-is; tagging is the likely next step
    setTimeout(() => this.$('tags').focus(), 50);
  }

  renderPageCard(tab) {
    const url = tab?.url || '';
    let host = '';
    let display = url;
    try {
      const parsed = new URL(url);
      host = parsed.hostname.replace(/^www\./, '');
      display = `${host}${parsed.pathname === '/' ? '' : parsed.pathname}`;
    } catch {
      // non-URL (e.g. chrome:// pages) — show raw
    }
    this.$('urlDisplay').textContent = display;
    this.$('urlDisplay').title = url;

    const favicon = this.$('pageFavicon');
    favicon.replaceChildren();
    const fallback = () => {
      favicon.replaceChildren();
      favicon.textContent = (host || tab?.title || '?').charAt(0);
    };
    if (tab?.favIconUrl && /^(https?:|data:)/.test(tab.favIconUrl)) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = tab.favIconUrl;
      img.addEventListener('error', fallback);
      favicon.appendChild(img);
    } else {
      fallback();
    }
  }

  showNoteForm() {
    this.showState('noteState');
    this.setChrome({ signedIn: true });
    this.setMode('note');
    this.currentState = 'note';
    this.lastFormState = 'note';

    const noteContent = this.$('noteContent');
    if (!this.formDirty.note) {
      this.formDirty.note = true;
      noteContent.value = this.currentTab?.url
        ? `Source: ${this.currentTab.url}\n\n`
        : '';
      this.$('noteTitle').value = '';
    }

    setTimeout(() => {
      noteContent.focus();
      const end = noteContent.value.length;
      noteContent.setSelectionRange(end, end);
    }, 50);
  }

  showSuccess(type = 'bookmark', offline = false) {
    const isNote = type === 'note';
    this.formDirty[isNote ? 'note' : 'bookmark'] = false;
    this.showState('successState');
    this.setChrome({ signedIn: true });
    this.$('modeSwitch').classList.add('hidden');
    this.currentState = 'success';

    this.$('successTitle').textContent = isNote
      ? 'Note saved'
      : 'Bookmark saved';
    this.$('successMessage').textContent = offline
      ? "You're offline — it will sync when you reconnect."
      : "It's ready in your Turbodoc library.";
    const link = this.$('successLink');
    link.textContent = isNote ? 'View notes' : 'View bookmarks';
    link.href = `${APP_URL}/${isNote ? 'notes' : 'bookmarks'}`;
    setTimeout(() => this.$('doneButton').focus(), 50);
  }

  showError(message) {
    this.showState('errorState');
    this.$('errorMessage').textContent = message;
    this.$('modeSwitch').classList.add('hidden');
    this.$('popupFooter').classList.add('hidden');
    this.currentState = 'error';
  }

  showToast(message, type = 'info', duration = 3000) {
    const container = this.$('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  retryLastAction() {
    if (!this.api.isAuthenticated()) {
      this.showLogin();
    } else if (this.lastFormState === 'note') {
      this.showNoteForm();
    } else {
      this.showBookmarkForm();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new TurbodocPopup();
});
