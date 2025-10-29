/**
 * Turbodoc API Configuration
 * Configuration settings for Turbodoc API integration
 */

const API_CONFIG = {
  baseUrl: 'https://api.turbodoc.ai',
  version: 'v1',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
};

/**
 * Get full API endpoint URL
 */
function getApiUrl(endpoint) {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_CONFIG.baseUrl}/${API_CONFIG.version}/${cleanEndpoint}`;
}

/**
 * Validate API configuration
 */
function validateApiConfig() {
  if (!API_CONFIG.baseUrl) {
    console.error('❌ API base URL not configured');
    return false;
  }

  return true;
}

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API_CONFIG, getApiUrl, validateApiConfig };
} else if (typeof window !== 'undefined') {
  window.API_CONFIG = API_CONFIG;
  window.getApiUrl = getApiUrl;
  window.validateApiConfig = validateApiConfig;
} else {
  // Extension context
  this.API_CONFIG = API_CONFIG;
  this.getApiUrl = getApiUrl;
  this.validateApiConfig = validateApiConfig;
}
