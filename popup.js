const urlToggle = document.getElementById('urlToggle');
const elementToggle = document.getElementById('elementToggle');

let currentGlobalState = true;
let currentHideMethod = 'udm';
let isUpdating = false; // prevent race cond

function updateUI(isGloballyEnabled, hideMethod) {
  currentGlobalState = isGloballyEnabled;
  currentHideMethod = hideMethod;
  
  if (hideMethod === 'udm') {
    urlToggle.checked = isGloballyEnabled;
    elementToggle.checked = false;
  } else if (hideMethod === 'dom') {
    urlToggle.checked = false;
    elementToggle.checked = isGloballyEnabled;
  }
}

function handleToggleChange(toggleType, isChecked) {
  if (isUpdating) return; // prevent race cond
  isUpdating = true;

  let newMethod = toggleType === 'url' ? 'udm' : 'dom';
  let newEnabled = isChecked;

  // if turning on, the other toggle is off (mutual exclusivity)
  if (isChecked) {
    // set the method
    chrome.runtime.sendMessage({ action: 'setHideMethod', method: newMethod }, function(methodResponse) {
      if (chrome.runtime.lastError) {
        console.error("Runtime error:", chrome.runtime.lastError);
        isUpdating = false;
        fetchAndUpdateState();
        return;
      }

      if (methodResponse && methodResponse.success) {
        // then enable
        chrome.runtime.sendMessage({ action: 'setGlobalEnable', enabled: true }, function(enableResponse) {
          isUpdating = false;
          
          if (chrome.runtime.lastError) {
            console.error("Runtime error:", chrome.runtime.lastError);
            fetchAndUpdateState();
            return;
          }

          if (enableResponse && enableResponse.success) {
            currentGlobalState = true;
            currentHideMethod = newMethod;
            updateUI(currentGlobalState, currentHideMethod);
            reloadGoogleSearchTab();
          } else {
            console.error("Failed to enable:", enableResponse ? enableResponse.error : "No response");
            fetchAndUpdateState();
          }
        });
      } else {
        isUpdating = false;
        console.error("Failed to set method:", methodResponse ? methodResponse.error : "No response");
        fetchAndUpdateState();
      }
    });
  } else {
    // turning off - just disable
    chrome.runtime.sendMessage({ action: 'setGlobalEnable', enabled: false }, function(response) {
      isUpdating = false;
      
      if (chrome.runtime.lastError) {
        console.error("Runtime error:", chrome.runtime.lastError);
        fetchAndUpdateState();
        return;
      }

      if (response && response.success) {
        currentGlobalState = false;
        updateUI(currentGlobalState, currentHideMethod);
        reloadGoogleSearchTab();
      } else {
        console.error("Failed to disable:", response ? response.error : "No response");
        fetchAndUpdateState();
      }
    });
  }
}

function reloadGoogleSearchTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs.length > 0 && tabs[0].id && tabs[0].url) {
      const tabUrl = tabs[0].url;
      const isGoogleSearchPage = tabUrl.includes('.google.') && tabUrl.includes('/search?');
      if (isGoogleSearchPage) {
        chrome.tabs.reload(tabs[0].id, { bypassCache: true });
      }
    }
  });
}

function fetchAndUpdateState() {
  chrome.runtime.sendMessage({ action: 'getState' }, function(response) {
    if (chrome.runtime.lastError) {
      console.error("Runtime error fetching state:", chrome.runtime.lastError);
      updateUI(false, 'udm'); 
      return;
    }

    if (response && response.isGloballyEnabled !== undefined && response.hideMethod !== undefined) {
      currentGlobalState = response.isGloballyEnabled;
      currentHideMethod = response.hideMethod;
      updateUI(currentGlobalState, currentHideMethod);
    } else {
      console.error("Failed to get initial state from background script.");
      updateUI(false, 'udm');
    }
  });
}

fetchAndUpdateState();

urlToggle.addEventListener('change', function() {
  handleToggleChange('url', urlToggle.checked);
});

elementToggle.addEventListener('change', function() {
  handleToggleChange('element', elementToggle.checked);
});