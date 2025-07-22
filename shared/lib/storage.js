/**
 * Storage Management Utilities
 * Handles secure storage of authentication tokens and user preferences
 */

class StorageManager {
  constructor(browserCompat) {
    this.storage = browserCompat.storage;
    this.STORAGE_KEYS = {
      // Legacy keys (kept for migration)
      AUTH_TOKEN: 'turbodoc_auth_token',
      USER_DATA: 'turbodoc_user_data',
      // Current keys
      SUPABASE_SESSION: 'turbodoc-extension-auth', // Matches Supabase storage key
      PREFERENCES: 'turbodoc_preferences',
      OFFLINE_QUEUE: 'turbodoc_offline_queue',
      LAST_SYNC: 'turbodoc_last_sync'
    };
  }

  /**
   * Store authentication token securely
   */
  async setAuthToken(token, expiresAt = null) {
    try {
      const authData = {
        token,
        expiresAt,
        createdAt: Date.now()
      };
      
      await this.storage.local.set({
        [this.STORAGE_KEYS.AUTH_TOKEN]: authData
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to store authentication token' 
      };
    }
  }

  /**
   * Retrieve authentication token
   */
  async getAuthToken() {
    try {
      const result = await this.storage.local.get(this.STORAGE_KEYS.AUTH_TOKEN);
      const authData = result[this.STORAGE_KEYS.AUTH_TOKEN];
      
      if (!authData || !authData.token) {
        return { success: true, data: null };
      }

      // Check if token is expired
      if (authData.expiresAt && Date.now() > new Date(authData.expiresAt).getTime()) {
        await this.clearAuthToken();
        return { success: true, data: null };
      }

      return { 
        success: true, 
        data: {
          token: authData.token,
          expiresAt: authData.expiresAt,
          createdAt: authData.createdAt
        }
      };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to retrieve authentication token' 
      };
    }
  }

  /**
   * Clear authentication token
   */
  async clearAuthToken() {
    try {
      await this.storage.local.remove(this.STORAGE_KEYS.AUTH_TOKEN);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to clear authentication token' 
      };
    }
  }

  /**
   * Store user data
   */
  async setUserData(userData) {
    try {
      await this.storage.local.set({
        [this.STORAGE_KEYS.USER_DATA]: {
          ...userData,
          updatedAt: Date.now()
        }
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to store user data' 
      };
    }
  }

  /**
   * Retrieve user data
   */
  async getUserData() {
    try {
      const result = await this.storage.local.get(this.STORAGE_KEYS.USER_DATA);
      const userData = result[this.STORAGE_KEYS.USER_DATA];
      
      return { 
        success: true, 
        data: userData || null 
      };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to retrieve user data' 
      };
    }
  }

  /**
   * Clear user data
   */
  async clearUserData() {
    try {
      await this.storage.local.remove(this.STORAGE_KEYS.USER_DATA);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to clear user data' 
      };
    }
  }

  /**
   * Store user preferences
   */
  async setPreferences(preferences) {
    try {
      const currentPrefs = await this.getPreferences();
      const updatedPrefs = {
        ...currentPrefs.data,
        ...preferences,
        updatedAt: Date.now()
      };

      await this.storage.local.set({
        [this.STORAGE_KEYS.PREFERENCES]: updatedPrefs
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to store preferences' 
      };
    }
  }

  /**
   * Retrieve user preferences
   */
  async getPreferences() {
    try {
      const result = await this.storage.local.get(this.STORAGE_KEYS.PREFERENCES);
      const preferences = result[this.STORAGE_KEYS.PREFERENCES] || this.getDefaultPreferences();
      
      return { 
        success: true, 
        data: preferences 
      };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to retrieve preferences',
        data: this.getDefaultPreferences()
      };
    }
  }

  /**
   * Get default preferences
   */
  getDefaultPreferences() {
    return {
      autoClosePopup: true,
      autoCloseDelay: 1500,
      showNotifications: true,
      defaultTags: [],
      theme: 'light'
    };
  }

  /**
   * Add bookmark to offline queue
   */
  async addToOfflineQueue(bookmarkData) {
    try {
      const result = await this.storage.local.get(this.STORAGE_KEYS.OFFLINE_QUEUE);
      const queue = result[this.STORAGE_KEYS.OFFLINE_QUEUE] || [];
      
      queue.push({
        ...bookmarkData,
        id: Date.now() + Math.random(), // Temporary ID
        queuedAt: Date.now()
      });

      await this.storage.local.set({
        [this.STORAGE_KEYS.OFFLINE_QUEUE]: queue
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to add bookmark to offline queue' 
      };
    }
  }

  /**
   * Get offline queue
   */
  async getOfflineQueue() {
    try {
      const result = await this.storage.local.get(this.STORAGE_KEYS.OFFLINE_QUEUE);
      const queue = result[this.STORAGE_KEYS.OFFLINE_QUEUE] || [];
      
      return { 
        success: true, 
        data: queue 
      };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to retrieve offline queue',
        data: []
      };
    }
  }

  /**
   * Remove item from offline queue
   */
  async removeFromOfflineQueue(itemId) {
    try {
      const result = await this.storage.local.get(this.STORAGE_KEYS.OFFLINE_QUEUE);
      const queue = result[this.STORAGE_KEYS.OFFLINE_QUEUE] || [];
      
      const updatedQueue = queue.filter(item => item.id !== itemId);

      await this.storage.local.set({
        [this.STORAGE_KEYS.OFFLINE_QUEUE]: updatedQueue
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to remove item from offline queue' 
      };
    }
  }

  /**
   * Clear offline queue
   */
  async clearOfflineQueue() {
    try {
      await this.storage.local.remove(this.STORAGE_KEYS.OFFLINE_QUEUE);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to clear offline queue' 
      };
    }
  }

  /**
   * Set last sync timestamp
   */
  async setLastSync(timestamp = Date.now()) {
    try {
      await this.storage.local.set({
        [this.STORAGE_KEYS.LAST_SYNC]: timestamp
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to set last sync timestamp' 
      };
    }
  }

  /**
   * Get last sync timestamp
   */
  async getLastSync() {
    try {
      const result = await this.storage.local.get(this.STORAGE_KEYS.LAST_SYNC);
      const lastSync = result[this.STORAGE_KEYS.LAST_SYNC] || 0;
      
      return { 
        success: true, 
        data: lastSync 
      };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to retrieve last sync timestamp',
        data: 0
      };
    }
  }

  /**
   * Clear all data (logout)
   */
  async clearAll() {
    try {
      await this.storage.local.clear();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to clear all data' 
      };
    }
  }

  /**
   * Get storage usage stats
   */
  async getStorageStats() {
    try {
      const allData = await this.storage.local.get(null);
      const stats = {
        totalKeys: Object.keys(allData).length,
        authTokenExists: !!allData[this.STORAGE_KEYS.AUTH_TOKEN],
        userDataExists: !!allData[this.STORAGE_KEYS.USER_DATA],
        offlineQueueLength: (allData[this.STORAGE_KEYS.OFFLINE_QUEUE] || []).length,
        lastSync: allData[this.STORAGE_KEYS.LAST_SYNC] || 0
      };
      
      return { 
        success: true, 
        data: stats 
      };
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to get storage stats' 
      };
    }
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
} else if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
} else {
  // Extension context
  this.StorageManager = StorageManager;
}