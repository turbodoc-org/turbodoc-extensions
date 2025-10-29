/**
 * Browser Compatibility Layer
 * Abstracts differences between Chrome and Firefox APIs
 */

// Detect browser environment
const isChrome = typeof chrome !== 'undefined' && chrome.runtime;
const isFirefox = typeof browser !== 'undefined' && browser.runtime;

// Unified browser API namespace
const browserAPI = isFirefox ? browser : chrome;

/**
 * Unified storage API
 */
const storage = {
  local: {
    get: (keys) => {
      return new Promise((resolve, reject) => {
        if (isFirefox) {
          browserAPI.storage.local.get(keys).then(resolve, reject);
        } else {
          browserAPI.storage.local.get(keys, (result) => {
            if (browserAPI.runtime.lastError) {
              reject(browserAPI.runtime.lastError);
            } else {
              resolve(result);
            }
          });
        }
      });
    },

    set: (items) => {
      return new Promise((resolve, reject) => {
        if (isFirefox) {
          browserAPI.storage.local.set(items).then(resolve, reject);
        } else {
          browserAPI.storage.local.set(items, () => {
            if (browserAPI.runtime.lastError) {
              reject(browserAPI.runtime.lastError);
            } else {
              resolve();
            }
          });
        }
      });
    },

    remove: (keys) => {
      return new Promise((resolve, reject) => {
        if (isFirefox) {
          browserAPI.storage.local.remove(keys).then(resolve, reject);
        } else {
          browserAPI.storage.local.remove(keys, () => {
            if (browserAPI.runtime.lastError) {
              reject(browserAPI.runtime.lastError);
            } else {
              resolve();
            }
          });
        }
      });
    },

    clear: () => {
      return new Promise((resolve, reject) => {
        if (isFirefox) {
          browserAPI.storage.local.clear().then(resolve, reject);
        } else {
          browserAPI.storage.local.clear(() => {
            if (browserAPI.runtime.lastError) {
              reject(browserAPI.runtime.lastError);
            } else {
              resolve();
            }
          });
        }
      });
    },
  },
};

/**
 * Unified tabs API
 */
const tabs = {
  query: (queryInfo) => {
    return new Promise((resolve, reject) => {
      if (isFirefox) {
        browserAPI.tabs.query(queryInfo).then(resolve, reject);
      } else {
        browserAPI.tabs.query(queryInfo, (result) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      }
    });
  },

  create: (createProperties) => {
    return new Promise((resolve, reject) => {
      if (isFirefox) {
        browserAPI.tabs.create(createProperties).then(resolve, reject);
      } else {
        browserAPI.tabs.create(createProperties, (result) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      }
    });
  },
};

/**
 * Unified runtime API
 */
const runtime = {
  sendMessage: (message) => {
    return new Promise((resolve, reject) => {
      if (isFirefox) {
        browserAPI.runtime.sendMessage(message).then(resolve, reject);
      } else {
        browserAPI.runtime.sendMessage(message, (response) => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      }
    });
  },

  onMessage: {
    addListener: (callback) => {
      if (isFirefox) {
        browserAPI.runtime.onMessage.addListener((message, sender) => {
          return Promise.resolve(callback(message, sender));
        });
      } else {
        browserAPI.runtime.onMessage.addListener(
          (message, sender, sendResponse) => {
            const result = callback(message, sender);
            if (result && typeof result.then === 'function') {
              result.then(sendResponse);
              return true; // Indicates async response
            } else {
              sendResponse(result);
            }
          },
        );
      }
    },
  },
};

/**
 * Unified context menus API
 */
const contextMenus = {
  create: (createProperties) => {
    return new Promise((resolve, reject) => {
      if (isFirefox) {
        browserAPI.contextMenus.create(createProperties).then(resolve, reject);
      } else {
        const id = browserAPI.contextMenus.create(createProperties, () => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve(id);
          }
        });
      }
    });
  },

  removeAll: () => {
    return new Promise((resolve, reject) => {
      if (isFirefox) {
        browserAPI.contextMenus.removeAll().then(resolve, reject);
      } else {
        browserAPI.contextMenus.removeAll(() => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve();
          }
        });
      }
    });
  },

  onClicked: {
    addListener: (callback) => {
      browserAPI.contextMenus.onClicked.addListener(callback);
    },
  },
};

/**
 * Unified action/browserAction API
 */
const action = {
  setBadgeText: (details) => {
    return new Promise((resolve, reject) => {
      const api = isFirefox ? browserAPI.browserAction : browserAPI.action;
      if (isFirefox) {
        api.setBadgeText(details).then(resolve, reject);
      } else {
        api.setBadgeText(details, () => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve();
          }
        });
      }
    });
  },

  setBadgeBackgroundColor: (details) => {
    return new Promise((resolve, reject) => {
      const api = isFirefox ? browserAPI.browserAction : browserAPI.action;
      if (isFirefox) {
        api.setBadgeBackgroundColor(details).then(resolve, reject);
      } else {
        api.setBadgeBackgroundColor(details, () => {
          if (browserAPI.runtime.lastError) {
            reject(browserAPI.runtime.lastError);
          } else {
            resolve();
          }
        });
      }
    });
  },
};

// Export unified API
const api = {
  storage,
  tabs,
  runtime,
  contextMenus,
  action,
  // Browser detection
  isChrome,
  isFirefox,
};

// Make available in different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
} else if (typeof window !== 'undefined') {
  window.browserCompat = api;
} else {
  // Extension context
  this.browserCompat = api;
}
