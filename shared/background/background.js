/**
 * Background Service Worker/Script
 * Handles context menu integration, authentication persistence, and offline queue processing
 */

// Import browser compatibility layer
importScripts(
  '../lib/browser-compat.js',
  '../lib/supabase-bundle.js',
  '../lib/supabase-config.js',
  '../lib/api-config.js',
  '../lib/supabase-client.js',
  '../lib/storage.js', 
  '../lib/api-client.js'
);

class TurbodocBackground {
  constructor() {
    this.api = new TurbodocAPI();
    this.storage = new StorageManager(browserCompat);
    this.isInitialized = false;
    
    this.init();
  }

  /**
   * Initialize background service
   */
  async init() {
    if (this.isInitialized) {return;}
    
    try {
      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize authentication
      await this.initializeAuth();
      
      // Set up context menus
      await this.setupContextMenus();
      
      // Process offline queue
      await this.processOfflineQueue();
      
      // Set up periodic sync
      this.setupPeriodicSync();
      
      this.isInitialized = true;
      console.log('Turbodoc background service initialized');
    } catch (error) {
      console.error('Failed to initialize background service:', error);
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Handle messages from popup/content scripts
    browserCompat.runtime.onMessage.addListener(async (message, sender) => {
      return await this.handleMessage(message, sender);
    });

    // Handle context menu clicks
    browserCompat.contextMenus.onClicked.addListener(async (info, tab) => {
      await this.handleContextMenuClick(info, tab);
    });

    // Handle browser startup (Chrome only)
    if (browserCompat.isChrome && chrome.runtime.onStartup) {
      chrome.runtime.onStartup.addListener(() => {
        this.init();
      });
    }

    // Handle extension install/update
    if (chrome.runtime.onInstalled) {
      chrome.runtime.onInstalled.addListener((details) => {
        this.handleInstallUpdate(details);
      });
    }
  }

  /**
   * Initialize authentication from storage
   */
  async initializeAuth() {
    try {
      // Initialize API (which will initialize Supabase and check for existing sessions)
      await this.api.init();
      
      if (this.api.isAuthenticated()) {
        // Update badge to show authenticated status
        await this.updateBadge();
        
        console.log('User authenticated:', this.api.getCurrentUser()?.email);
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    }
  }

  /**
   * Set up context menus
   */
  async setupContextMenus() {
    try {
      // Remove existing context menus
      await browserCompat.contextMenus.removeAll();
      
      // Create main context menu item
      await browserCompat.contextMenus.create({
        id: 'save-to-turbodoc',
        title: 'Save to Turbodoc',
        contexts: ['page', 'link'],
        documentUrlPatterns: ['http://*/*', 'https://*/*']
      });

      // Create link-specific context menu
      await browserCompat.contextMenus.create({
        id: 'save-link-to-turbodoc',
        title: 'Save Link to Turbodoc',
        contexts: ['link'],
        documentUrlPatterns: ['http://*/*', 'https://*/*']
      });

    } catch (error) {
      console.error('Failed to setup context menus:', error);
    }
  }

  /**
   * Handle messages from other parts of the extension
   */
  async handleMessage(message, sender) {
    switch (message.type) {
    case 'GET_AUTH_STATUS':
      return {
        isAuthenticated: this.api.isAuthenticated(),
        user: this.api.getCurrentUser()
      };

    case 'LOGOUT':
      await this.handleLogout();
      return { success: true };

    case 'BOOKMARK_SAVED':
      await this.updateBadge();
      await this.processOfflineQueue();
      return { success: true };

    case 'GET_CURRENT_TAB':
      const tabs = await browserCompat.tabs.query({ active: true, currentWindow: true });
      return { tab: tabs[0] || null };

    case 'PROCESS_OFFLINE_QUEUE':
      await this.processOfflineQueue();
      return { success: true };

    default:
      console.warn('Unknown message type:', message.type);
      return { error: 'Unknown message type' };
    }
  }

  /**
   * Handle context menu clicks
   */
  async handleContextMenuClick(info, tab) {
    try {
      // Check if user is authenticated
      if (!this.api.isAuthenticated()) {
        // Create notification or show popup
        await this.showNotification('Please sign in to Turbodoc first', 'Sign in by clicking the Turbodoc extension icon');
        return;
      }

      let bookmarkData;

      if (info.menuItemId === 'save-link-to-turbodoc' && info.linkUrl) {
        // Save the clicked link
        bookmarkData = {
          title: info.selectionText || info.linkUrl,
          url: info.linkUrl,
          contentType: 'link',
          notes: info.selectionText ? `From: ${tab.title}\n\nSelected text: ${info.selectionText}` : `From: ${tab.title}`,
          tags: []
        };
      } else {
        // Save the current page
        bookmarkData = {
          title: tab.title || tab.url,
          url: tab.url,
          contentType: 'link',
          notes: info.selectionText ? `Selected text: ${info.selectionText}` : '',
          tags: []
        };
      }

      // Try to save the bookmark
      const result = await this.api.createBookmark(bookmarkData);
      
      if (result.success) {
        await this.showNotification('Bookmark Saved!', `"${bookmarkData.title}" was saved to Turbodoc`);
        await this.updateBadge();
      } else {
        // Save to offline queue if network error
        if (result.error.includes('Network') || result.error.includes('Server')) {
          await this.storage.addToOfflineQueue(bookmarkData);
          await this.showNotification('Saved Offline', 'Bookmark will sync when connection is restored');
        } else {
          await this.showNotification('Error', result.error);
        }
      }

    } catch (error) {
      console.error('Context menu error:', error);
      await this.showNotification('Error', 'Failed to save bookmark');
    }
  }

  /**
   * Handle extension install/update
   */
  async handleInstallUpdate(details) {
    if (details.reason === 'install') {
      // First time installation
      console.log('Turbodoc extension installed');
      
      // Optionally show welcome page
      // await browserCompat.tabs.create({ url: 'https://turbodoc.com/welcome' });
      
    } else if (details.reason === 'update') {
      // Extension updated
      console.log(`Turbodoc extension updated to ${chrome.runtime.getManifest().version}`);
      
      // Process any pending offline items after update
      await this.processOfflineQueue();
    }
  }

  /**
   * Handle logout
   */
  async handleLogout() {
    try {
      await this.api.logout();
      
      // Clear badge
      await browserCompat.action.setBadgeText({ text: '' });
      
      console.log('User logged out');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Process offline bookmark queue
   */
  async processOfflineQueue() {
    if (!this.api.isAuthenticated()) {
      return;
    }

    try {
      const queueResult = await this.storage.getOfflineQueue();
      if (!queueResult.success || queueResult.data.length === 0) {
        return;
      }

      const queue = queueResult.data;
      let processedCount = 0;
      let failedCount = 0;

      for (const item of queue) {
        try {
          const result = await this.api.createBookmark(item);
          
          if (result.success) {
            await this.storage.removeFromOfflineQueue(item.id);
            processedCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          console.error('Failed to process offline item:', error);
          failedCount++;
        }
      }

      if (processedCount > 0) {
        console.log(`Processed ${processedCount} offline bookmarks`);
        await this.updateBadge();
        
        // Show notification if significant number processed
        if (processedCount > 1) {
          await this.showNotification('Sync Complete', `${processedCount} offline bookmarks synced`);
        }
      }

      if (failedCount > 0) {
        console.warn(`Failed to process ${failedCount} offline bookmarks`);
      }

    } catch (error) {
      console.error('Error processing offline queue:', error);
    }
  }

  /**
   * Set up periodic sync for offline items
   */
  setupPeriodicSync() {
    // Process offline queue every 5 minutes when online
    setInterval(async () => {
      if (navigator.onLine && this.api.isAuthenticated()) {
        await this.processOfflineQueue();
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('Back online, processing offline queue');
        this.processOfflineQueue();
      });
    }
  }

  /**
   * Update extension badge
   */
  async updateBadge() {
    try {
      if (!this.api.isAuthenticated()) {
        await browserCompat.action.setBadgeText({ text: '' });
        return;
      }

      // Check for offline items
      const queueResult = await this.storage.getOfflineQueue();
      const offlineCount = queueResult.success ? queueResult.data.length : 0;

      if (offlineCount > 0) {
        await browserCompat.action.setBadgeText({ text: offlineCount.toString() });
        await browserCompat.action.setBadgeBackgroundColor({ color: '#f59e0b' }); // Orange for offline
      } else {
        await browserCompat.action.setBadgeText({ text: '' });
      }

    } catch (error) {
      console.error('Failed to update badge:', error);
    }
  }

  /**
   * Show notification to user
   */
  async showNotification(title, message, type = 'basic') {
    try {
      // Check if notifications are supported
      if (typeof chrome !== 'undefined' && chrome.notifications) {
        chrome.notifications.create({
          type: type,
          iconUrl: '../icons/icon-48.png',
          title: title,
          message: message
        });
      } else {
        // Fallback: log to console
        console.log(`Notification: ${title} - ${message}`);
      }
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  /**
   * Get extension stats
   */
  async getStats() {
    try {
      const storageStats = await this.storage.getStorageStats();
      const lastSync = await this.storage.getLastSync();
      
      return {
        isAuthenticated: this.api.isAuthenticated(),
        user: this.api.getCurrentUser(),
        storageStats: storageStats.data,
        lastSync: lastSync.data,
        version: chrome.runtime.getManifest().version
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return null;
    }
  }
}

// Initialize background service
const turbodocBackground = new TurbodocBackground();

// Export for testing (if in test environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TurbodocBackground;
}