/**
 * Supabase Configuration
 * Configuration settings for Supabase integration
 */

const SUPABASE_CONFIG = {
  debug: true, // Enable debug mode for development
  url: (typeof process !== 'undefined' && process.env && process.env.SUPABASE_URL) || '',
  anonKey: (typeof process !== 'undefined' && process.env && process.env.SUPABASE_ANON_KEY) || '',
  auth: {
    // Set to false to disable auto refresh
    autoRefreshToken: true,
    // Set to false to disable persistent sessions
    persistSession: true,
    // Custom storage key prefix
    storageKey: 'turbodoc-extension-auth',
    // Session timeout (in seconds)
    sessionTimeout: 3600, // 1 hour
  },
};

// Development vs Production configuration
if (typeof chrome !== 'undefined' && chrome.runtime) {
  const manifest = chrome.runtime.getManifest();
  const isDevelopment = manifest.name.includes('Dev') || manifest.version.includes('dev');
  
  if (isDevelopment) {
    // Development configuration
    SUPABASE_CONFIG.url = '';
    SUPABASE_CONFIG.anonKey = '';
  }
}

// Validate configuration
function validateConfig() {
  if (!SUPABASE_CONFIG.url || SUPABASE_CONFIG.url.includes('your-project')) {
    console.error('❌ Supabase URL not configured. Please update supabase-config.js');
    return false;
  }
  
  if (!SUPABASE_CONFIG.anonKey || SUPABASE_CONFIG.anonKey.includes('your-anon-key')) {
    console.error('❌ Supabase anon key not configured. Please update supabase-config.js');
    return false;
  }
  
  return true;
}

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SUPABASE_CONFIG, validateConfig };
} else if (typeof window !== 'undefined') {
  window.SUPABASE_CONFIG = SUPABASE_CONFIG;
  window.validateSupabaseConfig = validateConfig;
} else {
  // Extension context
  this.SUPABASE_CONFIG = SUPABASE_CONFIG;
  this.validateSupabaseConfig = validateConfig;
}