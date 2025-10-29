/**
 * Supabase Client Loader for Browser Extension
 * Uses bundled Supabase client to avoid CSP issues
 */

class SupabaseLoader {
  constructor() {
    this.loaded = false;
    this.supabaseLib = null;
  }

  /**
   * Load Supabase library from bundle
   */
  loadSupabase() {
    if (this.loaded && this.supabaseLib) {
      return this.supabaseLib;
    }

    try {
      // Check if Supabase is already loaded from bundle
      if (typeof createClient !== 'undefined') {
        this.supabaseLib = { createClient };
        this.loaded = true;
        return this.supabaseLib;
      }

      // Check if supabase object is available
      if (typeof supabase !== 'undefined' && supabase.createClient) {
        this.supabaseLib = supabase;
        this.loaded = true;
        return this.supabaseLib;
      }

      // Check if window.createClient is available (from bundle)
      if (typeof window !== 'undefined' && window.createClient) {
        this.supabaseLib = { createClient: window.createClient };
        this.loaded = true;
        return this.supabaseLib;
      }

      throw new Error(
        'Supabase client not available. Make sure supabase-bundle.js is loaded.',
      );
    } catch (error) {
      console.error('Failed to load Supabase:', error);
      throw new Error('Supabase library could not be loaded');
    }
  }

  /**
   * Get createClient function
   */
  getCreateClient() {
    if (this.supabaseLib && this.supabaseLib.createClient) {
      return this.supabaseLib.createClient;
    }

    if (typeof createClient !== 'undefined') {
      return createClient;
    }

    if (typeof window !== 'undefined' && window.createClient) {
      return window.createClient;
    }

    throw new Error('Supabase createClient not available');
  }
}

// Global instance
const supabaseLoader = new SupabaseLoader();

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SupabaseLoader, supabaseLoader };
} else if (typeof window !== 'undefined') {
  window.SupabaseLoader = SupabaseLoader;
  window.supabaseLoader = supabaseLoader;
} else {
  // Extension context
  this.SupabaseLoader = SupabaseLoader;
  this.supabaseLoader = supabaseLoader;
}

// Auto-load Supabase when this script loads
(async () => {
  try {
    await supabaseLoader.loadSupabase();

    // Make createClient globally available
    if (!this.createClient && supabaseLoader.getCreateClient) {
      this.createClient = supabaseLoader.getCreateClient();
    }
  } catch (error) {
    console.warn('Auto-load Supabase failed:', error.message);
  }
})();
