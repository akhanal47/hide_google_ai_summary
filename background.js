let isGloballyEnabled = true;
let isInitialized = false;

// Initialize state on extension load
chrome.storage.sync.get(['isGloballyEnabled'], function(data) {
  isGloballyEnabled = data.isGloballyEnabled !== undefined ? data.isGloballyEnabled : true;
  
  chrome.storage.sync.set({
      'isGloballyEnabled': isGloballyEnabled
  }, () => {
      if (chrome.runtime.lastError) {
          console.error("Error saving initial state:", chrome.runtime.lastError);
      }
      isInitialized = true;
      updateVisualState(isGloballyEnabled);
  });
});

// who added the udm? extension or google
function isUdmAddedByExtension(url) {
  // extension added udm=14 is at end of url
  return url.endsWith('udm=14') || url.includes('udm=14#') || url.includes('udm=14&') === false;
}

// URL modification logic
chrome.webNavigation.onBeforeNavigate.addListener(function(details) {
  if (details.frameId !== 0) return;

  if (details.url.includes('/search?')) {
    try {
      const url = new URL(details.url);
      const currentUdm = url.searchParams.get('udm');
      const currentTbm = url.searchParams.get('tbm');
      
      if (isGloballyEnabled) {
        if (!currentUdm && !currentTbm) {
          url.searchParams.set('udm', '14');
          const newUrlString = url.toString();
          if (newUrlString !== details.url) {
            chrome.tabs.update(details.tabId, { url: newUrlString });
          }
        }
      } else {
        // remove udm=14 IFF added by extension
        if (currentUdm === '14' && isUdmAddedByExtension(details.url)) {
          url.searchParams.delete('udm');
          const newUrlString = url.toString();
          if (newUrlString !== details.url) {
            chrome.tabs.update(details.tabId, { url: newUrlString });
          }
        }
      }
    } catch (e) { 
      console.error("Error processing URL:", details.url, e); 
    }
  }
}, { url: [{ urlMatches: 'https?://[^/]*google\.[^/]+/search.*' }] });

// icon update
function updateVisualState(globallyEnabled) {
  const iconPath = globallyEnabled ? { "128": "assets/icon128.png" } : { "128": "assets/icon128_grey.png" };
  const title = globallyEnabled ? "Search Modifier (Web Only active)" : "Search Modifier (Globally Disabled)";
  
  chrome.action.setIcon({ path: iconPath }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error setting icon:", chrome.runtime.lastError);
    }
  });
  
  chrome.action.setTitle({ title: title }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error setting title:", chrome.runtime.lastError);
    }
  });
}

// clean current tab url immediately when toggled off
function cleanupCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs.length === 0 || !tabs[0].id || !tabs[0].url) return;

    const tabId = tabs[0].id;
    const currentTabUrl = tabs[0].url;

    if (currentTabUrl.includes('google.') && currentTabUrl.includes('/search?')) {
      try {
        const url = new URL(currentTabUrl);
        const currentUdm = url.searchParams.get('udm');

        // remove udm=14 IFF added by extension
        if (currentUdm === '14' && isUdmAddedByExtension(currentTabUrl)) {
           url.searchParams.delete('udm');
           const newUrlString = url.toString();
           if (newUrlString !== currentTabUrl) {
               chrome.tabs.update(tabId, { url: newUrlString });
           }
        }
      } catch (e) {
        console.error("Error cleaning up URL:", currentTabUrl, e);
      }
    }
  });
}

// message listener
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getState") {
    // Wait for initialization if not ready
    if (!isInitialized) {
      chrome.storage.sync.get(['isGloballyEnabled'], function(data) {
        isGloballyEnabled = data.isGloballyEnabled !== undefined ? data.isGloballyEnabled : true;
        isInitialized = true;
        sendResponse({ isGloballyEnabled: isGloballyEnabled });
      });
      return true;
    }
    sendResponse({ isGloballyEnabled: isGloballyEnabled });

  } else if (request.action === "setGlobalEnable") {
    const newState = request.enabled;

    if (typeof newState === 'boolean') {
        isGloballyEnabled = newState;
        updateVisualState(isGloballyEnabled);

        chrome.storage.sync.set({ 'isGloballyEnabled': isGloballyEnabled }, () => {
             if (chrome.runtime.lastError) {
                console.error("Error saving global state:", chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
             } else {
                if (newState === false) {
                    cleanupCurrentTab();
                }
                sendResponse({ success: true, isGloballyEnabled: isGloballyEnabled });
             }
        });
        return true;
    } else {
        sendResponse({ success: false, error: "Invalid enabled state provided" });
    }
  }
  
  return false;
});

// listen for extension icon clicks to ensure state is updated
chrome.action.onClicked.addListener(() => {
  updateVisualState(isGloballyEnabled);
});