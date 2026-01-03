const patterns = [
  /ai overview/i,  // en
  /übersicht mit ki/i, // de
  /AI による概要/, // ja
  /Обзор от ИИ/, // ru
  /AI 摘要/, // zh-TW
  /AI-overzicht/i, // nl
  /Vista creada con IA/i, // es
  /Přehled od AI/i, // cz
  // more patterns as they are added
];

let observer = null;
let isActive = false;

function hideAIOverview() {
  // find and hide AI overview H1 elements
  const aiOverviewH1 = [...document.querySelectorAll('h1')].find(h1 => 
    patterns.some(pattern => pattern.test(h1.innerText))
  );

  if (aiOverviewH1?.parentElement) {
    aiOverviewH1.parentElement.style.display = "none";
  }

  // adjust main element margin
  const mainElement = document.querySelector('[role="main"]');
  if (mainElement) {
    mainElement.style.marginTop = "24px";
  }

  // remove entries in "People also ask" section if it contains "AI overview"
  const peopleAlsoAskAiOverviews = [
    ...document.querySelectorAll("div.related-question-pair"),
  ].filter((el) => patterns.some((pattern) => pattern.test(el.innerHTML)));

  peopleAlsoAskAiOverviews.forEach((el) => {
    el.parentElement.parentElement.style.display = "none";
  });
}

function startObserver() {
  if (observer || !isActive) return;
  
  observer = new MutationObserver(() => {
    hideAIOverview();
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
  });
  
  // run once immediately
  hideAIOverview();
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// initialize based on storage settings
chrome.storage.sync.get(['isGloballyEnabled', 'hideMethod'], function(data) {
  const isGloballyEnabled = data.isGloballyEnabled !== undefined ? data.isGloballyEnabled : true;
  const hideMethod = data.hideMethod || 'udm';
  
  isActive = isGloballyEnabled && hideMethod === 'dom';
  
  if (isActive) {
    startObserver();
  }
});

// listen for storage changes
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'sync') {
    let shouldUpdate = false;
    let newIsActive = isActive;
    
    if (changes.isGloballyEnabled || changes.hideMethod) {
      chrome.storage.sync.get(['isGloballyEnabled', 'hideMethod'], function(data) {
        const isGloballyEnabled = data.isGloballyEnabled !== undefined ? data.isGloballyEnabled : true;
        const hideMethod = data.hideMethod || 'udm';
        
        newIsActive = isGloballyEnabled && hideMethod === 'dom';
        
        if (newIsActive !== isActive) {
          isActive = newIsActive;
          
          if (isActive) {
            startObserver();
          } else {
            stopObserver();
          }
        }
      });
    }
  }
});