const masterToggle = document.getElementById('masterToggle');
let currentGlobalState = true;
let isUpdating = false; // prevent race cond

function updateUI(isGloballyEnabled) {
  masterToggle.checked = isGloballyEnabled;
  currentGlobalState = isGloballyEnabled;
}

function handleStateUpdate(action, data) {
  if (isUpdating) return; // prevent race cond
  isUpdating = true;

  chrome.runtime.sendMessage({ action: action, ...data }, function(response) {
    isUpdating = false;
    
    if (chrome.runtime.lastError) {
      console.error("Runtime error:", chrome.runtime.lastError);
      fetchAndUpdateState();
      return;
    }

    if (response && response.success) {
      // update local state from response
      if (response.isGloballyEnabled !== undefined) {
        currentGlobalState = response.isGloballyEnabled;
        updateUI(currentGlobalState);
      }
      
      // reload tab if on Google search
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length > 0 && tabs[0].id && tabs[0].url) {
          const tabUrl = tabs[0].url;
          const isGoogleSearchPage = tabUrl.includes('.google.') && tabUrl.includes('/search?');
          if (isGoogleSearchPage) {
            chrome.tabs.reload(tabs[0].id, { bypassCache: true });
          }
        }
      });
    } else {
      console.error(`Failed to ${action}:`, response ? response.error : "No response");
      fetchAndUpdateState();
    }
  });
}

function fetchAndUpdateState() {
  chrome.runtime.sendMessage({ action: 'getState' }, function(response) {
    if (chrome.runtime.lastError) {
      console.error("Runtime error fetching state:", chrome.runtime.lastError);
      updateUI(false); 
      return;
    }

    if (response && response.isGloballyEnabled !== undefined) {
      currentGlobalState = response.isGloballyEnabled;
      updateUI(currentGlobalState);
    } else {
      console.error("Failed to get initial state from background script.");
      updateUI(false);
    }
  });
}

fetchAndUpdateState();

masterToggle.addEventListener('change', function() {
  const isEnabled = masterToggle.checked;
  handleStateUpdate('setGlobalEnable', { enabled: isEnabled });
});