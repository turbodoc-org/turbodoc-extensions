/**
 * Content Script for Page Interaction
 * Extracts page metadata and handles selected text for bookmark enhancement
 */

class TurbodocContent {
  constructor() {
    this.selectedText = '';
    this.pageMetadata = null;
    
    this.init();
  }

  /**
   * Initialize content script
   */
  init() {
    // Extract page metadata on load
    this.extractPageMetadata();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Listen for messages from popup/background
    this.setupMessageListener();
    
    console.log('Turbodoc content script initialized');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Track text selection
    document.addEventListener('selectionchange', () => {
      this.updateSelectedText();
    });

    // Track URL changes for SPA handling
    this.setupSPATracking();
  }

  /**
   * Set up message listener for communication with popup/background
   */
  setupMessageListener() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // Keep message channel open for async response
      });
    } else if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.onMessage.addListener((message, sender) => {
        return this.handleMessage(message, sender);
      });
    }
  }

  /**
   * Handle messages from popup/background
   */
  async handleMessage(message, sender, sendResponse) {
    switch (message.type) {
    case 'GET_PAGE_METADATA':
      const response = {
        metadata: this.pageMetadata,
        selectedText: this.selectedText,
        url: window.location.href,
        title: document.title
      };
        
      if (sendResponse) {
        sendResponse(response);
      }
      return response;

    case 'GET_SELECTED_TEXT':
      const textResponse = {
        selectedText: this.selectedText,
        hasSelection: this.selectedText.length > 0
      };
        
      if (sendResponse) {
        sendResponse(textResponse);
      }
      return textResponse;

    case 'EXTRACT_MAIN_CONTENT':
      const content = this.extractMainContent();
      const contentResponse = {
        content: content,
        wordCount: content.split(/\s+/).length
      };
        
      if (sendResponse) {
        sendResponse(contentResponse);
      }
      return contentResponse;

    case 'HIGHLIGHT_SAVED':
      this.showSaveConfirmation();
      break;

    default:
      console.warn('Unknown message type:', message.type);
      return { error: 'Unknown message type' };
    }
  }

  /**
   * Update selected text
   */
  updateSelectedText() {
    const selection = window.getSelection();
    this.selectedText = selection.toString().trim();
  }

  /**
   * Extract page metadata
   */
  extractPageMetadata() {
    this.pageMetadata = {
      title: this.getPageTitle(),
      description: this.getMetaDescription(),
      keywords: this.getMetaKeywords(),
      author: this.getMetaAuthor(),
      publishDate: this.getPublishDate(),
      canonicalUrl: this.getCanonicalUrl(),
      openGraph: this.getOpenGraphData(),
      twitterCard: this.getTwitterCardData(),
      articleData: this.getArticleData(),
      siteName: this.getSiteName(),
      language: this.getLanguage(),
      favicon: this.getFaviconUrl()
    };
  }

  /**
   * Get page title (prefer og:title, then title tag)
   */
  getPageTitle() {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {return ogTitle.getAttribute('content');}
    
    const title = document.querySelector('title');
    if (title) {return title.textContent.trim();}
    
    const h1 = document.querySelector('h1');
    if (h1) {return h1.textContent.trim();}
    
    return document.title || window.location.href;
  }

  /**
   * Get meta description
   */
  getMetaDescription() {
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {return ogDesc.getAttribute('content');}
    
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {return metaDesc.getAttribute('content');}
    
    return null;
  }

  /**
   * Get meta keywords
   */
  getMetaKeywords() {
    const keywords = document.querySelector('meta[name="keywords"]');
    return keywords ? keywords.getAttribute('content').split(',').map(k => k.trim()) : [];
  }

  /**
   * Get meta author
   */
  getMetaAuthor() {
    const author = document.querySelector('meta[name="author"]');
    if (author) {return author.getAttribute('content');}
    
    const articleAuthor = document.querySelector('meta[property="article:author"]');
    if (articleAuthor) {return articleAuthor.getAttribute('content');}
    
    return null;
  }

  /**
   * Get publish date
   */
  getPublishDate() {
    const publishedTime = document.querySelector('meta[property="article:published_time"]');
    if (publishedTime) {return publishedTime.getAttribute('content');}
    
    const datePublished = document.querySelector('meta[property="datePublished"]');
    if (datePublished) {return datePublished.getAttribute('content');}
    
    // Try to find date in structured data
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd.textContent);
        if (data.datePublished) {return data.datePublished;}
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
    
    return null;
  }

  /**
   * Get canonical URL
   */
  getCanonicalUrl() {
    const canonical = document.querySelector('link[rel="canonical"]');
    return canonical ? canonical.getAttribute('href') : window.location.href;
  }

  /**
   * Get Open Graph data
   */
  getOpenGraphData() {
    const ogTags = document.querySelectorAll('meta[property^="og:"]');
    const og = {};
    
    ogTags.forEach(tag => {
      const property = tag.getAttribute('property').replace('og:', '');
      const content = tag.getAttribute('content');
      og[property] = content;
    });
    
    return og;
  }

  /**
   * Get Twitter Card data
   */
  getTwitterCardData() {
    const twitterTags = document.querySelectorAll('meta[name^="twitter:"]');
    const twitter = {};
    
    twitterTags.forEach(tag => {
      const name = tag.getAttribute('name').replace('twitter:', '');
      const content = tag.getAttribute('content');
      twitter[name] = content;
    });
    
    return twitter;
  }

  /**
   * Get article-specific data
   */
  getArticleData() {
    const articleTags = document.querySelectorAll('meta[property^="article:"]');
    const article = {};
    
    articleTags.forEach(tag => {
      const property = tag.getAttribute('property').replace('article:', '');
      const content = tag.getAttribute('content');
      article[property] = content;
    });
    
    return article;
  }

  /**
   * Get site name
   */
  getSiteName() {
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName) {return ogSiteName.getAttribute('content');}
    
    const siteName = document.querySelector('meta[name="application-name"]');
    if (siteName) {return siteName.getAttribute('content');}
    
    // Try to extract from hostname
    const hostname = window.location.hostname;
    return hostname.replace(/^www\./, '');
  }

  /**
   * Get language
   */
  getLanguage() {
    return document.documentElement.lang || 
           document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content') ||
           'en';
  }

  /**
   * Get favicon URL
   */
  getFaviconUrl() {
    const icon = document.querySelector('link[rel="icon"]') || 
                 document.querySelector('link[rel="shortcut icon"]') ||
                 document.querySelector('link[rel="apple-touch-icon"]');
                 
    if (icon) {
      const href = icon.getAttribute('href');
      if (href.startsWith('http')) {
        return href;
      } else if (href.startsWith('/')) {
        return window.location.origin + href;
      } else {
        return new URL(href, window.location.href).href;
      }
    }
    
    // Default favicon path
    return window.location.origin + '/favicon.ico';
  }

  /**
   * Extract main content from page
   */
  extractMainContent() {
    // Try different strategies to find main content
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.main-content',
      '.post-content',
      '.entry-content',
      '#content',
      '#main'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return this.extractTextContent(element);
      }
    }

    // Fallback: extract from body but exclude navigation, footer, etc.
    const body = document.body.cloneNode(true);
    
    // Remove unwanted elements
    const unwantedSelectors = [
      'nav', 'header', 'footer', 'aside',
      '.navigation', '.nav', '.menu',
      '.sidebar', '.footer', '.header',
      '.advertisement', '.ads', '.ad',
      'script', 'style', 'noscript'
    ];

    unwantedSelectors.forEach(selector => {
      const elements = body.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });

    return this.extractTextContent(body);
  }

  /**
   * Extract clean text content from element
   */
  extractTextContent(element) {
    // Clone to avoid modifying original
    const clone = element.cloneNode(true);
    
    // Remove script and style elements
    const scripts = clone.querySelectorAll('script, style');
    scripts.forEach(el => el.remove());
    
    // Get text content and clean it up
    const text = clone.textContent || clone.innerText || '';
    
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n+/g, '\n') // Normalize line breaks
      .trim()
      .substring(0, 2000); // Limit length
  }

  /**
   * Set up SPA (Single Page Application) tracking
   */
  setupSPATracking() {
    let currentUrl = window.location.href;

    // Override pushState and replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    const onUrlChange = () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        // Re-extract metadata for new page
        setTimeout(() => {
          this.extractPageMetadata();
        }, 100);
      }
    };

    history.pushState = function() {
      originalPushState.apply(history, arguments);
      onUrlChange();
    };

    history.replaceState = function() {
      originalReplaceState.apply(history, arguments);
      onUrlChange();
    };

    // Listen for popstate (back/forward)
    window.addEventListener('popstate', onUrlChange);
    
    // Listen for hashchange
    window.addEventListener('hashchange', onUrlChange);
  }

  /**
   * Show save confirmation (visual feedback)
   */
  showSaveConfirmation() {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      transition: all 0.3s ease;
      transform: translateX(100%);
    `;
    notification.textContent = '✓ Saved to Turbodoc';

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);

    // Animate out and remove
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 2000);
  }

  /**
   * Get reading time estimate
   */
  getReadingTimeEstimate() {
    const text = this.extractMainContent();
    const words = text.split(/\s+/).length;
    const readingTime = Math.ceil(words / 200); // Average reading speed: 200 words/minute
    return {
      words,
      minutes: readingTime,
      text: readingTime === 1 ? '1 min read' : `${readingTime} min read`
    };
  }
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new TurbodocContent();
  });
} else {
  new TurbodocContent();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TurbodocContent;
}