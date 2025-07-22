/**
 * Turbodoc API Client with Supabase Authentication
 * Manages authentication and API communication using Supabase
 */

class TurbodocAPI {
  constructor() {
    this.supabase = null;
    this.session = null;
    this.user = null;
    this.isInitialized = false;
    
    this.init();
  }

  /**
   * Initialize Supabase client
   */
  async init() {
    if (this.isInitialized) {return;}

    try {
      // Validate configuration
      console.log('Validating Supabase configuration...');
      if (!validateSupabaseConfig()) {
        throw new Error('Supabase configuration is invalid');
      }

      // Initialize Supabase client
      console.log('Creating Supabase client...');
      if (typeof createClient !== 'undefined') {
        console.log('Initializing Supabase client...');
        console.log('Supabase URL:', SUPABASE_CONFIG.url);
        console.log('Anon Key:', SUPABASE_CONFIG.anonKey ? '***' : 'Not set');
        this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
          auth: {
            autoRefreshToken: SUPABASE_CONFIG.auth.autoRefreshToken,
            persistSession: SUPABASE_CONFIG.auth.persistSession,
            storageKey: SUPABASE_CONFIG.auth.storageKey,
            storage: new SupabaseExtensionStorage()
          }
        });

        // Get initial session
        const { data: { session } } = await this.supabase.auth.getSession();
        this.setSession(session);

        // Listen for auth changes
        this.supabase.auth.onAuthStateChange((event, session) => {
          console.log('Auth state changed:', event);
          this.setSession(session);
        });

        this.isInitialized = true;
        console.log('Supabase client initialized');
      } else {
        throw new Error('Supabase client not available');
      }
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Set current session
   */
  setSession(session) {
    this.session = session;
    this.user = session?.user || null;
  }

  /**
   * Make authenticated request to custom API or Supabase
   */
  async request(endpoint, options = {}) {
    await this.init();

    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    if (!validateApiConfig()) {
      throw new Error('API configuration is invalid');
    }

    const url = getApiUrl(endpoint);
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.session?.access_token) {
      headers.Authorization = `Bearer ${this.session.access_token}`;
    }

    const requestOptions = {
      method: 'GET',
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('UNAUTHORIZED');
        }
        if (response.status === 403) {
          throw new Error('FORBIDDEN');
        }
        if (response.status === 404) {
          throw new Error('NOT_FOUND');
        }
        if (response.status >= 500) {
          throw new Error('SERVER_ERROR');
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('NETWORK_ERROR');
      }
      throw error;
    }
  }


  /**
   * Authenticate user with Supabase
   */
  async login(email, password) {
    try {
      await this.init();

      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      this.setSession(data.session);

      return {
        success: true,
        data: {
          session: data.session,
          user: data.user
        }
      };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error.message)
      };
    }
  }

  /**
   * Sign up new user
   */
  async signUp(email, password, metadata = {}) {
    try {
      await this.init();

      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: {
          session: data.session,
          user: data.user
        }
      };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error.message)
      };
    }
  }

  /**
   * Refresh authentication session
   */
  async refreshSession() {
    try {
      await this.init();

      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await this.supabase.auth.refreshSession();

      if (error) {
        throw error;
      }

      this.setSession(data.session);
      
      return {
        success: true,
        data: data.session
      };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error.message)
      };
    }
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      await this.init();

      if (this.supabase) {
        const { error } = await this.supabase.auth.signOut();
        if (error) {
          console.warn('Logout error:', error);
        }
      }

      this.setSession(null);

      return { success: true };
    } catch (error) {
      // Even if logout fails on server, clear local state
      this.setSession(null);
      return { success: true };
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email) {
    try {
      await this.init();

      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { error } = await this.supabase.auth.resetPasswordForEmail(email);

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error.message)
      };
    }
  }

  /**
   * Create new bookmark
   */
  async createBookmark(bookmarkData) {
    try {
      await this.init();

      if (!this.user) {
        throw new Error('User not authenticated');
      }

      // Format payload according to Turbodoc API spec
      const payload = {
        title: bookmarkData.title,
        url: bookmarkData.url,
        tags: Array.isArray(bookmarkData.tags) ? bookmarkData.tags.join(',') : bookmarkData.tags || '',
        status: 'unread' // Default status
      };

      const response = await this.request('bookmarks', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Create bookmark error:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.message)
      };
    }
  }

  /**
   * Get recent bookmarks
   */
  async getRecentBookmarks(limit = 10) {
    try {
      const response = await this.request(`/bookmarks?limit=${limit}`);
      
      return {
        success: true,
        data: response
      };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error.message)
      };
    }
  }

  /**
   * Update bookmark
   */
  async updateBookmark(id, updates) {
    try {
      const response = await this.request(`/bookmarks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });

      return {
        success: true,
        data: response
      };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error.message)
      };
    }
  }

  /**
   * Delete bookmark
   */
  async deleteBookmark(id) {
    try {
      await this.request(`/bookmarks/${id}`, {
        method: 'DELETE'
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error.message)
      };
    }
  }

  /**
   * Get user tags for autocomplete
   */
  async getUserTags() {
    try {
      const response = await this.request('/user/tags');
      
      return {
        success: true,
        data: response.tags || []
      };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error.message),
        data: []
      };
    }
  }

  /**
   * Get user stats for badge
   */
  async getUserStats() {
    try {
      const response = await this.request('/user/stats');
      
      return {
        success: true,
        data: response
      };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error.message)
      };
    }
  }

  /**
   * Convert error codes to user-friendly messages
   */
  getErrorMessage(errorCode) {
    const errorMessages = {
      'UNAUTHORIZED': 'Please sign in to continue',
      'FORBIDDEN': 'Access denied',
      'NOT_FOUND': 'Resource not found',
      'SERVER_ERROR': 'Server error. Please try again later',
      'NETWORK_ERROR': 'Network error. Please check your connection',
      'TIMEOUT': 'Request timeout. Please try again'
    };

    return errorMessages[errorCode] || errorCode || 'An unexpected error occurred';
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.session && !!this.user;
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * Get current session
   */
  getCurrentSession() {
    return this.session;
  }
}

/**
 * Custom storage adapter for Supabase in browser extensions
 * Uses browser extension storage API instead of localStorage
 */
class SupabaseExtensionStorage {
  constructor() {
    this.storageManager = null;
  }

  async init() {
    if (!this.storageManager && typeof StorageManager !== 'undefined') {
      this.storageManager = new StorageManager(browserCompat);
    }
  }

  async getItem(key) {
    await this.init();
    
    if (this.storageManager) {
      const result = await this.storageManager.storage.local.get(key);
      return result[key] || null;
    }
    
    // Fallback to localStorage if available
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    
    return null;
  }

  async setItem(key, value) {
    await this.init();
    
    if (this.storageManager) {
      await this.storageManager.storage.local.set({ [key]: value });
      return;
    }
    
    // Fallback to localStorage if available
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }

  async removeItem(key) {
    await this.init();
    
    if (this.storageManager) {
      await this.storageManager.storage.local.remove(key);
      return;
    }
    
    // Fallback to localStorage if available
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TurbodocAPI, SupabaseExtensionStorage };
} else if (typeof window !== 'undefined') {
  window.TurbodocAPI = TurbodocAPI;
  window.SupabaseExtensionStorage = SupabaseExtensionStorage;
} else {
  // Extension context
  this.TurbodocAPI = TurbodocAPI;
  this.SupabaseExtensionStorage = SupabaseExtensionStorage;
}